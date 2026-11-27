#!/usr/bin/env python3
"""
Python Debug Adapter Protocol (DAP) 服务端：基于标准库 bdb/sys.settrace 实现，零第三方依赖。
用法：python3 -X utf8 py_dap.py <userFullPath> <off> <n> <stdinFile> <scriptPath> [scriptArgs...]
通过 duplicated FD 0/1 收发标准 Content-Length DAP 帧；被调试脚本的 stdin/stdout/stderr 严格隔离到 dap.stdin 与管道，
绝不会因 print / os.write(1, ...) 污染 DAP 协议帧。
"""
import bdb
import io
import json
import os
import sys
import threading
import traceback

USER_PATH = os.path.realpath(os.path.abspath(sys.argv[1]))
USER_NAME = os.path.basename(USER_PATH)
OFF = int(sys.argv[2])
N = int(sys.argv[3])
STDIN_FILE = sys.argv[4]
SCRIPT_PATH = os.path.realpath(os.path.abspath(sys.argv[5]))
SCRIPT_ARGS = sys.argv[6:]

# Preserve original stdio FDs exclusively for DAP framing
_DAP_IN_FD = os.dup(0)
_DAP_OUT_FD = os.dup(1)
_DAP_IN = os.fdopen(_DAP_IN_FD, "rb", 0)
_DAP_OUT = os.fdopen(_DAP_OUT_FD, "wb", 0)

# Redirect FD 0 to stdinFile (if any) so both input() and sys.stdin.buffer work cleanly
if STDIN_FILE and os.path.exists(STDIN_FILE):
    _in_fd = os.open(STDIN_FILE, os.O_RDONLY)
else:
    _in_fd = os.open(os.devnull, os.O_RDONLY)
os.dup2(_in_fd, 0)
os.close(_in_fd)
sys.stdin = os.fdopen(0, "r", encoding="utf-8", errors="replace", closefd=False)

# Redirect FD 1 & FD 2 into pipes pumped as DAP output events
_OUT_R_FD, _OUT_W_FD = os.pipe()
_ERR_R_FD, _ERR_W_FD = os.pipe()
os.dup2(_OUT_W_FD, 1)
os.dup2(_ERR_W_FD, 2)
os.close(_OUT_W_FD)
os.close(_ERR_W_FD)
sys.stdout = io.TextIOWrapper(os.fdopen(1, "wb", 0, closefd=False), encoding="utf-8", errors="replace", write_through=True)
sys.stderr = io.TextIOWrapper(os.fdopen(2, "wb", 0, closefd=False), encoding="utf-8", errors="replace", write_through=True)

_OUT_LOCK = threading.Lock()
_SEQ = 0


def next_seq():
    global _SEQ
    _SEQ += 1
    return _SEQ


def send_msg(obj):
    with _OUT_LOCK:
        obj["seq"] = next_seq()
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        hdr = f"Content-Length: {len(raw)}\r\n\r\n".encode("ascii")
        try:
            _DAP_OUT.write(hdr)
            _DAP_OUT.write(raw)
            _DAP_OUT.flush()
        except OSError:
            pass


def send_response(req, success=True, body=None, message=None):
    resp = {
        "type": "response",
        "request_seq": req.get("seq", 0),
        "success": success,
        "command": req.get("command", ""),
    }
    if body is not None:
        resp["body"] = body
    if not success and message is not None:
        resp["message"] = message
    send_msg(resp)


def send_event(event, body=None):
    ev = {"type": "event", "event": event}
    if body is not None:
        ev["body"] = body
    send_msg(ev)


def pump_fd(fd, category, done_evt):
    buf = b""
    try:
        while True:
            chunk = os.read(fd, 4096)
            if not chunk:
                break
            buf += chunk
            try:
                text = buf.decode("utf-8")
                buf = b""
            except UnicodeDecodeError:
                # Hold trailing incomplete UTF-8 sequence if < 4 bytes remain
                if len(buf) > 4:
                    text = buf[:-3].decode("utf-8", errors="replace")
                    buf = buf[-3:]
                else:
                    continue
            if text:
                send_event("output", {"category": category, "output": text})
    except OSError:
        pass
    finally:
        if buf:
            send_event("output", {"category": category, "output": buf.decode("utf-8", errors="replace")})
        try:
            os.close(fd)
        except OSError:
            pass
        done_evt.set()


_OUT_DONE = threading.Event()
_ERR_DONE = threading.Event()
threading.Thread(target=pump_fd, args=(_OUT_R_FD, "stdout", _OUT_DONE), daemon=True).start()
threading.Thread(target=pump_fd, args=(_ERR_R_FD, "stderr", _ERR_DONE), daemon=True).start()


def safe_repr(val, max_len=200):
    try:
        s = repr(val)
    except Exception as exc:
        return f"<{type(val).__name__}: {exc}>"
    if len(s) > max_len:
        return s[: max_len - 1] + "…"
    return s


def is_expandable(val):
    if isinstance(val, (list, tuple, set, dict)):
        return len(val) > 0
    if hasattr(val, "__dict__") and not isinstance(val, type):
        return bool(val.__dict__)
    return False


class PyDapDebugger(bdb.Bdb):
    def __init__(self):
        super().__init__()
        self.cond = threading.Condition()
        self.bp_lines = set()
        self.paused = False
        self.current_frame = None
        self.pending_action = None  # "continue" | "next" | "stepIn" | "stepOut" | "quit"
        self.stepping = False
        self.stop_on_entry = False
        self.var_refs = {}
        self.frame_refs = {}
        self.next_ref = 100
        self.terminated = False
        self.worker_tid = 1

    def canonic(self, filename):
        if filename == "<" + filename[1:-1] + ">":
            return filename
        cached = self.fncache.get(filename)
        if cached:
            return cached
        real = os.path.realpath(os.path.abspath(filename))
        self.fncache[filename] = real
        return real

    def is_user_loc(self, frame):
        if frame is None:
            return False
        return self.canonic(frame.f_code.co_filename) == USER_PATH and OFF < frame.f_lineno <= OFF + N

    def set_user_breakpoints(self, lines):
        with self.cond:
            self.clear_all_breaks()
            self.bp_lines = set()
            for ln in lines:
                if OFF < ln <= OFF + N:
                    self.bp_lines.add(ln)
                    self.set_break(USER_PATH, ln)

    def _collect_user_frames(self, frame):
        frames = []
        f = frame
        while f is not None:
            if self.is_user_loc(f):
                frames.append(f)
            f = f.f_back
        return frames

    def user_line(self, frame):
        if self.terminated:
            self.set_quit()
            return
        in_user = self.is_user_loc(frame)
        hit_bp = in_user and frame.f_lineno in self.bp_lines and self.break_here(frame)
        if not in_user:
            if self.stepping:
                # If we stepped into another module (e.g. stdlib), return cleanly to caller;
                # if we left user lines back to the outer judge harness, resume until next breakpoint.
                if self.canonic(frame.f_code.co_filename) == USER_PATH:
                    self.stepping = False
                    self.set_continue()
                else:
                    self.set_return(frame)
            return

        if not hit_bp and not self.stepping and not self.stop_on_entry:
            return

        reason = "breakpoint" if hit_bp else ("entry" if self.stop_on_entry and not self.stepping else "step")
        self.stop_on_entry = False
        self.stepping = False

        with self.cond:
            self.paused = True
            self.current_frame = frame
            self.pending_action = None
            self.frame_refs.clear()
            self.var_refs.clear()
            send_event(
                "stopped",
                {
                    "reason": reason,
                    "threadId": self.worker_tid,
                    "allThreadsStopped": True,
                },
            )
            while self.paused and not self.terminated:
                self.cond.wait()
            action = self.pending_action
            self.current_frame = None
            self.pending_action = None

        if action == "quit" or self.terminated:
            self.set_quit()
        elif action == "next":
            self.stepping = True
            self.set_next(frame)
        elif action == "stepIn":
            self.stepping = True
            self.set_step()
        elif action == "stepOut":
            self.stepping = True
            self.set_return(frame)
        else:
            self.stepping = False
            self.set_continue()

    def user_exception(self, frame, exc_info):
        # Ignore BdbQuit and let normal traceback reach stderr when unhandled
        pass

    def alloc_ref(self, kind, payload):
        self.next_ref += 1
        ref = self.next_ref
        if kind == "frame":
            self.frame_refs[ref] = payload
        else:
            self.var_refs[ref] = payload
        return ref

    def resume(self, action):
        with self.cond:
            self.paused = False
            self.pending_action = action
            self.cond.notify_all()


DBG = PyDapDebugger()
START_EVT = threading.Event()
WORKER_STARTED = False
LAUNCHED = False
CONFIG_DONE = False


def maybe_start():
    global WORKER_STARTED
    if WORKER_STARTED or not (LAUNCHED and CONFIG_DONE):
        return
    WORKER_STARTED = True
    START_EVT.set()


def run_target():
    START_EVT.wait()
    if DBG.terminated:
        return
    sys.argv = [SCRIPT_PATH, *SCRIPT_ARGS]
    script_dir = os.path.dirname(SCRIPT_PATH)
    if script_dir and script_dir not in sys.path:
        sys.path.insert(0, script_dir)
    exit_code = 0
    try:
        with open(SCRIPT_PATH, "r", encoding="utf-8") as fh:
            src = fh.read()
        code_obj = compile(src, SCRIPT_PATH, "exec")
        globs = {"__name__": "__main__", "__file__": SCRIPT_PATH, "__package__": None}
        if DBG.stop_on_entry:
            DBG.stepping = True
            DBG.set_step()
        DBG.run(code_obj, globs, globs)
    except bdb.BdbQuit:
        pass
    except SystemExit as exc:
        if isinstance(exc.code, int):
            exit_code = exc.code
        elif exc.code:
            print(exc.code, file=sys.stderr)
            exit_code = 1
    except BaseException:
        traceback.print_exc(file=sys.stderr)
        exit_code = 1
    finally:
        try:
            sys.stdout.flush()
            sys.stderr.flush()
        except Exception:
            pass
        # Close our copies of FDs 1/2 so pump threads flush everything cleanly before terminated
        try:
            os.close(1)
        except OSError:
            pass
        try:
            os.close(2)
        except OSError:
            pass
        _OUT_DONE.wait(timeout=1.0)
        _ERR_DONE.wait(timeout=1.0)
        send_event("exited", {"exitCode": exit_code})
        send_event("terminated", {})


def format_var(name, val):
    vref = DBG.alloc_ref("var", val) if is_expandable(val) else 0
    return {
        "name": str(name),
        "value": safe_repr(val),
        "type": type(val).__name__,
        "variablesReference": vref,
    }


def list_children(val):
    items = []
    if isinstance(val, dict):
        for i, (k, v) in enumerate(val.items()):
            if i >= 60:
                items.append({"name": "…", "value": f"共 {len(val)} 项", "variablesReference": 0})
                break
            items.append(format_var(safe_repr(k, 40), v))
    elif isinstance(val, (list, tuple)):
        for i, v in enumerate(val):
            if i >= 60:
                items.append({"name": "…", "value": f"共 {len(val)} 项", "variablesReference": 0})
                break
            items.append(format_var(f"[{i}]", v))
    elif isinstance(val, set):
        for i, v in enumerate(val):
            if i >= 60:
                items.append({"name": "…", "value": f"共 {len(val)} 项", "variablesReference": 0})
                break
            items.append(format_var(f"#{i}", v))
    elif hasattr(val, "__dict__"):
        for k, v in list(val.__dict__.items())[:60]:
            items.append(format_var(k, v))
    return items


def handle_request(req):
    global LAUNCHED, CONFIG_DONE
    cmd = req.get("command", "")
    args = req.get("arguments") or {}

    if cmd == "initialize":
        send_response(
            req,
            True,
            {
                "supportsConfigurationDoneRequest": True,
                "supportsEvaluateForHovers": True,
                "supportsTerminateRequest": True,
            },
        )
        send_event("initialized", {})
        return

    if cmd == "launch":
        LAUNCHED = True
        if args.get("stopOnEntry"):
            DBG.stop_on_entry = True
        send_response(req, True, {})
        maybe_start()
        return

    if cmd == "setBreakpoints":
        req_bps = args.get("breakpoints") or []
        lines = []
        resp_bps = []
        for bp in req_bps:
            ln = int(bp.get("line", 0))
            if ln > 0:
                lines.append(ln)
            resp_bps.append({"verified": OFF < ln <= OFF + N, "line": ln})
        DBG.set_user_breakpoints(lines)
        send_response(req, True, {"breakpoints": resp_bps})
        return

    if cmd == "configurationDone":
        CONFIG_DONE = True
        send_response(req, True, {})
        maybe_start()
        return

    if cmd == "threads":
        send_response(req, True, {"threads": [{"id": DBG.worker_tid, "name": "MainThread"}]})
        return

    if cmd == "stackTrace":
        with DBG.cond:
            frames = DBG._collect_user_frames(DBG.current_frame) if DBG.paused else []
            out = []
            for f in frames:
                fid = DBG.alloc_ref("frame", f)
                fn_name = f.f_code.co_name
                if fn_name == "<module>":
                    fn_name = "<main>"
                out.append(
                    {
                        "id": fid,
                        "name": fn_name,
                        "line": f.f_lineno,
                        "column": 1,
                        "source": {"name": USER_NAME, "path": USER_PATH},
                    }
                )
        send_response(req, True, {"stackFrames": out, "totalFrames": len(out)})
        return

    if cmd == "scopes":
        frame_id = int(args.get("frameId", -1))
        with DBG.cond:
            frame = DBG.frame_refs.get(frame_id) or DBG.current_frame
            if frame is None:
                send_response(req, True, {"scopes": []})
                return
            loc_ref = DBG.alloc_ref("scope_locals", frame)
            scopes = [{"name": "Locals", "variablesReference": loc_ref, "expensive": False}]
        send_response(req, True, {"scopes": scopes})
        return

    if cmd == "variables":
        vref = int(args.get("variablesReference", 0))
        with DBG.cond:
            target = DBG.var_refs.get(vref)
            if target is None:
                send_response(req, True, {"variables": []})
                return
            if isinstance(target, type(sys._getframe())):
                variables = []
                for k, v in list(target.f_locals.items()):
                    if k.startswith("__") and k != "__self__":
                        continue
                    variables.append(format_var(k, v))
            else:
                variables = list_children(target)
        send_response(req, True, {"variables": variables})
        return

    if cmd == "evaluate":
        expr = str(args.get("expression", "")).strip()
        frame_id = int(args.get("frameId", -1))
        with DBG.cond:
            frame = DBG.frame_refs.get(frame_id) or DBG.current_frame
            if frame is None:
                send_response(req, True, {"result": "<未暂停>", "variablesReference": 0})
                return
            try:
                val = eval(expr, frame.f_globals, frame.f_locals)
                vref = DBG.alloc_ref("var", val) if is_expandable(val) else 0
                send_response(req, True, {"result": safe_repr(val), "type": type(val).__name__, "variablesReference": vref})
            except Exception as exc:
                send_response(req, False, None, f"{type(exc).__name__}: {exc}")
        return

    if cmd in ("continue", "next", "stepIn", "stepOut"):
        DBG.resume(cmd)
        body = {"allThreadsContinued": True} if cmd == "continue" else {}
        send_response(req, True, body)
        return

    if cmd in ("disconnect", "terminate"):
        DBG.terminated = True
        DBG.resume("quit")
        START_EVT.set()
        send_response(req, True, {})
        os._exit(0)

    send_response(req, True, {})


def read_frame():
    content_len = -1
    while True:
        line = _DAP_IN.readline()
        if not line:
            return None
        s = line.decode("ascii", errors="ignore").strip("\r\n")
        if not s:
            break
        if ":" in s:
            k, v = s.split(":", 1)
            if k.strip().lower() == "content-length":
                content_len = int(v.strip())
    if content_len < 0:
        return None
    buf = b""
    while len(buf) < content_len:
        chunk = _DAP_IN.read(content_len - len(buf))
        if not chunk:
            return None
        buf += chunk
    return json.loads(buf.decode("utf-8"))


def main():
    threading.Thread(target=run_target, daemon=True).start()
    while True:
        try:
            req = read_frame()
        except Exception:
            break
        if req is None:
            break
        handle_request(req)
    DBG.terminated = True
    DBG.resume("quit")
    START_EVT.set()


if __name__ == "__main__":
    main()
