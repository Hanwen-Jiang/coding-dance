# C++ 调试：在 gdb 里一步一步 step，停在用户代码里就记下行号、调用栈、变量。
# 用法：TRACE_CFG=<cfg.json> gdb -q -nx -batch -x gdb_trace.py
# 记录的格式和网站浏览器里的执行记录一样（site/lib/practice/types.ts 的 PracticeTrace），调试面板直接用。
import gdb
import json
import os
import re

CFG = json.load(open(os.environ["TRACE_CFG"], encoding="utf-8"))
SRC = os.path.basename(CFG["src"])
OFF, N = CFG["off"], CFG["n"]
LIMIT, MAX_BYTES, MAX_RAW = CFG.get("limit", 1000), 600000, CFG.get("maxRaw", 200000)
steps = []
state = {"bytes": 0, "full": False, "raw": 0, "signal": None}
active = []  # [(gdb.Frame, Ret)]：进入过的用户函数，返回时记一步 return


def user_line(sal):
    if sal is None or sal.symtab is None:
        return None
    if os.path.basename(sal.symtab.filename) != SRC:
        return None
    l = sal.line - OFF
    return l if 1 <= l <= N else None


def short_fn(frame):
    f = frame.function()
    name = (f.name if f is not None else frame.name()) or "?"
    name = name.split("(")[0]
    if "lambda" in name:
        return "lambda"
    return name.split("::")[-1] or name


def user_stack():
    out, f = [], gdb.newest_frame()
    while f is not None:
        try:
            l = user_line(f.find_sal())
            if l is not None:
                out.append([short_fn(f), l])
        except gdb.error:
            pass
        f = f.older()
    out.reverse()
    return out


def out_len():
    try:
        return max(0, os.path.getsize(CFG["stdout"]) - CFG.get("outSkip", 0))
    except OSError:
        return 0


def record(step):
    steps.append(step)
    state["bytes"] += len(json.dumps(step, ensure_ascii=False))
    if len(steps) >= LIMIT or state["bytes"] > MAX_BYTES:
        state["full"] = True


# —— 值怎么显示：和浏览器里的风格一致（容器类带类型和长度，比如 vector(3) [1, 2, 3]） ——
def tname(t):
    try:
        n = str(t.strip_typedefs().unqualified())
    except Exception:
        n = str(t)
    return re.sub(r"std::(__cxx11::|__1::)?", "", n)


def head(t):
    n = tname(t)
    i = n.find("<")
    return (n[:i] if i >= 0 else n).strip()


def esc(s, cap=60):
    if len(s) > cap:
        s = s[: cap - 1] + "…"
    return json.dumps(s, ensure_ascii=False)


def has_field(t, name):
    try:
        return any(f.name == name for f in t.fields())
    except Exception:
        return False


def fmt(v, depth=0):
    if not isinstance(v, gdb.Value):
        return str(v)
    try:
        return _fmt(v, depth)
    except Exception:
        return "<无法显示>"


def walk_list(p):
    out, seen = [], set()
    while int(p) != 0 and len(out) < 12:
        a = int(p)
        if a in seen:
            out.append("…（有环）")
            return "ListNode(" + " → ".join(out) + ")"
        seen.add(a)
        out.append(fmt(p.dereference()["val"], 3))
        p = p.dereference()["next"]
    if int(p) != 0:
        out.append("…")
    return "ListNode(" + " → ".join(out) + ")"


def manual(v, depth):
    """没有 libstdc++ 的漂亮打印时，vector 和 string 自己读"""
    h = head(v.type)
    try:
        if h == "vector":
            impl = v["_M_impl"]
            start, finish = impl["_M_start"], impl["_M_finish"]
            n = int(finish - start)
            items = [fmt((start + i).dereference(), depth + 1) for i in range(min(n, 12))]
            return "vector(%d) [%s%s]" % (n, ", ".join(items), ", …" if n > 12 else "")
        if h in ("basic_string", "string"):
            n = int(v["_M_string_length"])
            return esc(v["_M_dataplus"]["_M_p"].string(length=min(n, 200)))
    except Exception:
        return None
    return None


def pretty(v, vis, depth):
    hint = vis.display_hint() if hasattr(vis, "display_hint") else None
    h = head(v.type)
    if hint == "string" or h in ("basic_string", "string"):
        s = vis.to_string()
        if hasattr(s, "value") and callable(getattr(s, "value")):
            s = s.value()
        if isinstance(s, gdb.Value):
            try:
                s = s.string(length=200)
            except Exception:
                s = str(s)
        return esc(str(s))
    if not hasattr(vis, "children"):
        return str(vis.to_string())
    if depth >= 2:
        return h + "{…}"
    summary = str(vis.to_string() or "")
    m = re.search(r"(?:length|with) (\d+)", summary)
    size = int(m.group(1)) if m else None
    items, it, more = [], iter(vis.children()), False
    try:
        while True:
            if len(items) >= 12:
                next(it)
                more = True
                break
            if hint == "map":
                k, x = next(it)[1], next(it)[1]
                items.append("%s: %s" % (fmt(k, depth + 1), fmt(x, depth + 1)))
            else:
                items.append(fmt(next(it)[1], depth + 1))
    except StopIteration:
        pass
    if h in ("pair", "tuple"):
        return "(" + ", ".join(items) + ")"
    a, b = ("{", "}") if hint == "map" or "set" in h else ("[", "]")
    count = size if size is not None else len(items)
    return "%s(%d) %s%s%s%s" % (h, count, a, ", ".join(items), ", …" if more else "", b)


def _fmt(v, depth):
    t = v.type.strip_typedefs()
    if t.code in (gdb.TYPE_CODE_REF, getattr(gdb, "TYPE_CODE_RVALUE_REF", -1)):
        return _fmt(v.referenced_value(), depth)
    vis = gdb.default_visualizer(v)
    if vis is not None:
        return pretty(v, vis, depth)
    m = manual(v, depth)
    if m is not None:
        return m
    code = t.code
    if code == gdb.TYPE_CODE_PTR:
        if int(v) == 0:
            return "nullptr"
        tgt = t.target().strip_typedefs()
        nm = tgt.name or ""
        if nm == "ListNode" and has_field(tgt, "next"):
            return walk_list(v)
        if nm in ("TreeNode", "Node") and has_field(tgt, "val"):
            return "%s(%s)" % (nm, fmt(v.dereference()["val"], 3))
        if tgt.code == gdb.TYPE_CODE_INT and tgt.sizeof == 1:
            try:
                return esc(v.string(length=200))
            except Exception:
                pass
        if tgt.code == gdb.TYPE_CODE_STRUCT and depth == 0:
            return "→ " + _fmt(v.dereference(), depth + 1)
        return (nm or head(tgt)) + "*"
    if code == gdb.TYPE_CODE_ARRAY:
        lo, hi = t.range()
        n = hi - lo + 1
        items = [fmt(v[i], depth + 1) for i in range(lo, lo + min(n, 12))]
        return "[" + ", ".join(items) + (", …" if n > 12 else "") + "]"
    if code == gdb.TYPE_CODE_BOOL:
        return "true" if bool(v) else "false"
    if code == gdb.TYPE_CODE_INT and t.sizeof == 1 and (t.name or "").endswith("char"):
        c = int(v) & 0xFF
        return "'%s'" % chr(c) if 32 <= c < 127 else str(int(v))
    if code == gdb.TYPE_CODE_FLT:
        return "%.10g" % float(v)
    if code in (gdb.TYPE_CODE_STRUCT, gdb.TYPE_CODE_UNION):
        if depth >= 2:
            return "{…}"
        parts = []
        for f in t.fields():
            if f.is_base_class or not f.name or not hasattr(f, "bitpos") or f.name.startswith("_"):
                continue
            parts.append("%s: %s" % (f.name, fmt(v[f.name], depth + 1)))
            if len(parts) >= 8:
                parts.append("…")
                break
        h = head(t)
        return (h + " " if h else "") + "{" + ", ".join(parts) + "}"
    return str(v)


def frame_vars(frame, line_abs):
    """当前函数里看得到的变量：参数在前，局部变量按声明的先后；还没声明到的不显示"""
    try:
        block = frame.block()
    except RuntimeError:
        return []
    chain = []
    while block is not None:
        chain.append(block)
        if block.function is not None:
            break
        block = block.superblock
    found, seen = [], set()
    for depth, b in enumerate(chain):  # 里层优先（同名的里层变量遮住外层）
        for s in b:
            if not (s.is_argument or s.is_variable) or s.name in seen or s.name.startswith("__"):
                continue
            if not s.is_argument and s.line > line_abs:
                continue
            seen.add(s.name)
            found.append((0 if s.is_argument else 1, len(chain) - depth, s.line, s))
    found.sort(key=lambda x: (x[0], x[1], x[2]))
    out = []
    for _, _, _, s in found:
        try:
            v = s.value(frame)
        except Exception:
            continue
        if s.name == "this":
            try:
                obj = v.dereference()
                for f in obj.type.strip_typedefs().fields():
                    if f.is_base_class or not f.name or not hasattr(f, "bitpos"):
                        continue
                    out.append(["this->" + f.name, fmt(obj[f.name])])
                    if len(out) >= 40:
                        return out
            except Exception:
                pass
            continue
        out.append([s.name, fmt(v)])
        if len(out) >= 40:
            break
    return out


class Ret(gdb.FinishBreakpoint):
    """一个用户函数返回时记一步 return（带返回值）"""

    def __init__(self, frame, info):
        super().__init__(frame, internal=True)
        self.silent = True
        self.info = info

    def stop(self):
        drop(self)
        if not state["full"]:
            i = self.info
            step = {"line": i["line"], "event": "return", "fn": i["fn"], "stack": i["stack"], "vars": i["vars"], "out": out_len()}
            try:
                if self.return_value is not None:
                    step["ret"] = fmt(self.return_value)
            except Exception:
                pass
            record(step)
        return False

    def out_of_scope(self):
        drop(self)


def drop(bp):
    for i, (_, b) in enumerate(active):
        if b is bp:
            del active[i]
            return


def track(frame, step):
    for f, b in active:
        if f == frame:
            b.info = step
            return
    if len(active) >= 300 or frame.older() is None:
        return
    try:
        active.append((frame, Ret(frame, step)))
    except Exception:
        pass


def on_stop(ev):
    if isinstance(ev, gdb.SignalEvent) and ev.stop_signal not in ("SIGTRAP", "0"):
        state["signal"] = ev.stop_signal


SIGNALS = {"SIGSEGV": "段错误：访问了空指针、越界，或者递归太深", "SIGABRT": "程序中止（abort）", "SIGFPE": "算术错误（比如除以 0）", "SIGBUS": "非法内存访问"}


def alive():
    try:
        return gdb.selected_inferior().pid != 0 and len(gdb.selected_inferior().threads()) > 0
    except Exception:
        return False


def main():
    for cmd in ("set pagination off", "set confirm off", "set width 0", "set debuginfod enabled off", "set disable-randomization off", "set print pretty off"):
        try:
            gdb.execute(cmd, to_string=True)
        except gdb.error:
            pass
    gdb.execute("file " + CFG["exe"], to_string=True)
    # 不进标准库、判题程序的辅助函数
    for cmd in ("skip -gfi /usr/*", "skip -gfi */prelude.h", "skip -rfu ^std::", "skip -rfu ^__gnu", "skip function jMark", "skip function jEmit", "skip function jTypeName", "skip function jReset"):
        try:
            gdb.execute(cmd, to_string=True)
        except gdb.error:
            pass
    gdb.events.stop.connect(on_stop)
    gdb.execute("break main", to_string=True)
    gdb.execute("run %s < %s > %s 2> %s" % (" ".join(CFG["args"]), CFG["stdin"], CFG["stdout"], CFG["stderr"]), to_string=True)
    while not state["full"] and state["raw"] < MAX_RAW and alive():
        if state["signal"]:
            sig = state["signal"]
            f, l, fn = gdb.newest_frame(), None, "main"
            while f is not None and l is None:
                l = user_line(f.find_sal())
                fn = short_fn(f)
                f = f.older()
            if l is not None:
                record({"line": l, "event": "exception", "fn": fn, "stack": user_stack(), "vars": [], "out": out_len(), "exc": "%s：%s" % (sig, SIGNALS.get(sig, "程序收到了信号"))})
            break
        frame = gdb.selected_frame()
        sal = frame.find_sal()
        l = user_line(sal)
        if l is not None:
            step = {"line": l, "event": "line", "fn": short_fn(frame), "stack": user_stack(), "vars": frame_vars(frame, sal.line), "out": out_len()}
            record(step)
            track(frame, step)
        state["raw"] += 1
        try:
            gdb.execute("step", to_string=True)
        except gdb.error:
            break
    if alive():
        try:
            gdb.execute("kill", to_string=True)
        except gdb.error:
            pass


try:
    main()
finally:
    with open(CFG["trace"], "w", encoding="utf-8") as f:
        json.dump({"steps": steps, "truncated": state["full"] or (state["raw"] >= MAX_RAW), "limit": LIMIT, "signal": state["signal"]}, f, ensure_ascii=False)
