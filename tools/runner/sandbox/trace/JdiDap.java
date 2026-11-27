// Java Debug Adapter Protocol (DAP) 服务端：基于 JDK 标准库 com.sun.jdi.* 实现，零外部 JAR 依赖。
// 在隔离沙箱（Firecracker microVM / Docker 容器）内由 dap-session.js 拉起，通过 stdin/stdout 收发标准 Content-Length DAP 帧。
// 参数：java -cp <jdi目录> JdiDap <stdin文件> <用户源文件名> <行号偏移off> <用户代码行数n> <判题标记tok或空串> <classpath> <主类> [主类参数…]
import com.sun.jdi.*;
import com.sun.jdi.connect.*;
import com.sun.jdi.event.*;
import com.sun.jdi.request.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public class JdiDap {
    static String inPath, userFile, tok, cp, mainClass;
    static int off, n;
    static String[] mainArgs;

    static VirtualMachine vm;
    static EventRequestManager erm;
    static volatile ThreadReference stoppedThread;
    static final Object outLock = new Object();
    static final AtomicInteger outSeq = new AtomicInteger(1);
    static final Set<Integer> wantedUserLines = ConcurrentHashMap.newKeySet();
    static final List<BreakpointRequest> activeBps = new ArrayList<>();
    static final List<StepRequest> activeSteps = new ArrayList<>();
    static final Map<Integer, FrameRef> frameRefs = new ConcurrentHashMap<>();
    static final AtomicInteger refSeq = new AtomicInteger(1000);
    static boolean launched = false;
    static boolean configDone = false;
    static boolean vmStarted = false;

    static class FrameRef {
        final ThreadReference thread;
        final int depth;
        FrameRef(ThreadReference t, int d) { this.thread = t; this.depth = d; }
    }

    static final String[] EXCLUDE = {"java.*", "javax.*", "sun.*", "jdk.*", "com.sun.*", "kotlin.*", "scala.*", "H", "HR", "JH", "JH$", "JudgeMain", "JudgeMain$"};

    public static void main(String[] a) throws Exception {
        inPath = a[0];
        userFile = a[1];
        off = Integer.parseInt(a[2]);
        n = Integer.parseInt(a[3]);
        tok = a[4];
        cp = a[5];
        mainClass = a[6];
        mainArgs = Arrays.copyOfRange(a, 7, a.length);

        InputStream in = System.in;
        while (true) {
            String frame = readDapFrame(in);
            if (frame == null) break;
            handleRequest(frame);
        }
        shutdownVm();
    }

    static String readDapFrame(InputStream in) throws IOException {
        int contentLen = -1;
        StringBuilder line = new StringBuilder();
        while (true) {
            int b = in.read();
            if (b < 0) return null;
            if (b == '\n') {
                String s = line.toString().replace("\r", "");
                line.setLength(0);
                if (s.isEmpty()) break;
                int colon = s.indexOf(':');
                if (colon > 0 && s.substring(0, colon).trim().equalsIgnoreCase("Content-Length")) {
                    contentLen = Integer.parseInt(s.substring(colon + 1).trim());
                }
            } else {
                line.append((char) b);
            }
        }
        if (contentLen < 0) return null;
        byte[] buf = new byte[contentLen];
        int read = 0;
        while (read < contentLen) {
            int r = in.read(buf, read, contentLen - read);
            if (r < 0) return null;
            read += r;
        }
        return new String(buf, StandardCharsets.UTF_8);
    }

    static void sendRaw(String json) {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        String header = "Content-Length: " + bytes.length + "\r\n\r\n";
        synchronized (outLock) {
            try {
                System.out.write(header.getBytes(StandardCharsets.US_ASCII));
                System.out.write(bytes);
                System.out.flush();
            } catch (IOException ignored) {}
        }
    }

    static void sendResponse(int reqSeq, String command, boolean success, String bodyJson, String errMsg) {
        StringBuilder sb = new StringBuilder("{\"seq\":").append(outSeq.getAndIncrement())
            .append(",\"type\":\"response\",\"request_seq\":").append(reqSeq)
            .append(",\"success\":").append(success)
            .append(",\"command\":").append(q(command));
        if (!success && errMsg != null) sb.append(",\"message\":").append(q(errMsg));
        if (bodyJson != null) sb.append(",\"body\":").append(bodyJson);
        sb.append("}");
        sendRaw(sb.toString());
    }

    static void sendEvent(String event, String bodyJson) {
        StringBuilder sb = new StringBuilder("{\"seq\":").append(outSeq.getAndIncrement())
            .append(",\"type\":\"event\",\"event\":").append(q(event));
        if (bodyJson != null) sb.append(",\"body\":").append(bodyJson);
        sb.append("}");
        sendRaw(sb.toString());
    }

    static synchronized void handleRequest(String raw) {
        int seq = extractInt(raw, "\"seq\"", 1);
        String cmd = extractString(raw, "\"command\"");
        if (cmd == null) return;
        try {
            switch (cmd) {
                case "initialize":
                    sendResponse(seq, cmd, true, "{\"supportsConfigurationDoneRequest\":true,\"supportsEvaluateForHovers\":true}", null);
                    sendEvent("initialized", "{}");
                    break;
                case "launch":
                    launched = true;
                    sendResponse(seq, cmd, true, "{}", null);
                    maybeStartVm();
                    break;
                case "setBreakpoints": {
                    wantedUserLines.clear();
                    List<Integer> lines = extractBreakpointLines(raw);
                    wantedUserLines.addAll(lines);
                    applyBreakpoints();
                    StringBuilder bps = new StringBuilder("{\"breakpoints\":[");
                    for (int i = 0; i < lines.size(); i++) {
                        if (i > 0) bps.append(",");
                        bps.append("{\"verified\":true,\"line\":").append(lines.get(i)).append("}");
                    }
                    bps.append("]}");
                    sendResponse(seq, cmd, true, bps.toString(), null);
                    break;
                }
                case "configurationDone":
                    configDone = true;
                    sendResponse(seq, cmd, true, "{}", null);
                    maybeStartVm();
                    break;
                case "threads": {
                    StringBuilder tb = new StringBuilder("{\"threads\":[");
                    if (vm != null) {
                        boolean first = true;
                        for (ThreadReference t : vm.allThreads()) {
                            if (isSystemThread(t)) continue;
                            if (!first) tb.append(",");
                            first = false;
                            tb.append("{\"id\":").append(t.uniqueID()).append(",\"name\":").append(q(t.name())).append("}");
                        }
                    }
                    tb.append("]}");
                    sendResponse(seq, cmd, true, tb.toString(), null);
                    break;
                }
                case "stackTrace": {
                    ThreadReference t = findThread(extractLong(raw, "\"threadId\"", -1));
                    StringBuilder sb = new StringBuilder("{\"stackFrames\":[");
                    int count = 0;
                    if (t != null && t.isSuspended()) {
                        List<StackFrame> frames = t.frames();
                        for (int d = 0; d < frames.size(); d++) {
                            Location loc = frames.get(d).location();
                            int ul = userLine(loc);
                            if (ul <= 0) continue;
                            int fid = refSeq.getAndIncrement();
                            frameRefs.put(fid, new FrameRef(t, d));
                            if (count > 0) sb.append(",");
                            count++;
                            sb.append("{\"id\":").append(fid)
                              .append(",\"name\":").append(q(methodName(loc.method())))
                              .append(",\"line\":").append(ul)
                              .append(",\"column\":1,\"source\":{\"name\":").append(q(userFile)).append("}}");
                        }
                    }
                    sb.append("],\"totalFrames\":").append(count).append("}");
                    sendResponse(seq, cmd, true, sb.toString(), null);
                    break;
                }
                case "scopes": {
                    int frameId = extractInt(raw, "\"frameId\"", -1);
                    sendResponse(seq, cmd, true, "{\"scopes\":[{\"name\":\"Locals\",\"variablesReference\":" + frameId + ",\"expensive\":false}]}", null);
                    break;
                }
                case "variables": {
                    int vref = extractInt(raw, "\"variablesReference\"", -1);
                    FrameRef fr = frameRefs.get(vref);
                    StringBuilder vb = new StringBuilder("{\"variables\":[");
                    if (fr != null && fr.thread.isSuspended() && fr.depth < fr.thread.frameCount()) {
                        StackFrame f = fr.thread.frame(fr.depth);
                        List<String[]> vars = readFrameVars(f);
                        for (int i = 0; i < vars.size(); i++) {
                            if (i > 0) vb.append(",");
                            vb.append("{\"name\":").append(q(vars.get(i)[0]))
                              .append(",\"value\":").append(q(vars.get(i)[1]))
                              .append(",\"type\":").append(q(vars.get(i)[2]))
                              .append(",\"variablesReference\":0}");
                        }
                    }
                    vb.append("]}");
                    sendResponse(seq, cmd, true, vb.toString(), null);
                    break;
                }
                case "evaluate": {
                    String expr = extractString(raw, "\"expression\"");
                    int frameId = extractInt(raw, "\"frameId\"", -1);
                    String val = evalSimple(expr, frameId);
                    sendResponse(seq, cmd, true, "{\"result\":" + q(val) + ",\"variablesReference\":0}", null);
                    break;
                }
                case "continue":
                    clearSteps();
                    resumeVm();
                    sendResponse(seq, cmd, true, "{\"allThreadsContinued\":true}", null);
                    break;
                case "next":
                    stepVm(raw, StepRequest.STEP_OVER);
                    sendResponse(seq, cmd, true, "{}", null);
                    break;
                case "stepIn":
                    stepVm(raw, StepRequest.STEP_INTO);
                    sendResponse(seq, cmd, true, "{}", null);
                    break;
                case "stepOut":
                    stepVm(raw, StepRequest.STEP_OUT);
                    sendResponse(seq, cmd, true, "{}", null);
                    break;
                case "disconnect":
                case "terminate":
                    sendResponse(seq, cmd, true, "{}", null);
                    shutdownVm();
                    System.exit(0);
                    break;
                default:
                    sendResponse(seq, cmd, true, "{}", null);
            }
        } catch (Exception e) {
            sendResponse(seq, cmd, false, null, e.getMessage() != null ? e.getMessage() : e.toString());
        }
    }

    static void maybeStartVm() throws Exception {
        if (vmStarted || !launched || !configDone) return;
        vmStarted = true;
        LaunchingConnector lc = Bootstrap.virtualMachineManager().defaultConnector();
        Map<String, Connector.Argument> args = lc.defaultArguments();
        StringBuilder mainSpec = new StringBuilder(mainClass);
        for (String ma : mainArgs) mainSpec.append(' ').append(ma);
        args.get("main").setValue(mainSpec.toString());
        args.get("options").setValue("-cp " + cp + " -Xss64m -Xmx512m -XX:+UseSerialGC -XX:-UsePerfData -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8");
        vm = lc.launch(args);
        erm = vm.eventRequestManager();

        Process p = vm.process();
        new Thread(() -> {
            try (OutputStream o = p.getOutputStream()) {
                if (inPath != null && !inPath.isEmpty() && Files.exists(Paths.get(inPath))) {
                    Files.copy(Paths.get(inPath), o);
                }
            } catch (IOException ignored) {}
        }, "dap-stdin").start();
        pumpOutput(p.getInputStream(), "stdout");
        pumpOutput(p.getErrorStream(), "stderr");

        ClassPrepareRequest cpr = erm.createClassPrepareRequest();
        for (String ex : new String[]{"java.*", "javax.*", "sun.*", "jdk.*", "com.sun.*"}) cpr.addClassExclusionFilter(ex);
        cpr.setSuspendPolicy(EventRequest.SUSPEND_EVENT_THREAD);
        cpr.enable();

        applyBreakpoints();
        vm.resume();

        new Thread(JdiDap::eventLoop, "dap-events").start();
    }

    static void pumpOutput(InputStream in, String category) {
        new Thread(() -> {
            try (Reader r = new InputStreamReader(in, StandardCharsets.UTF_8)) {
                char[] buf = new char[2048];
                for (int k; (k = r.read(buf)) > 0; ) {
                    String chunk = new String(buf, 0, k);
                    if (tok != null && !tok.isEmpty()) {
                        chunk = chunk.replaceAll("\\u0001" + java.util.regex.Pattern.quote(tok) + ":[SR]:[^\\u0002]*\\u0002", "");
                    }
                    if (!chunk.isEmpty()) {
                        sendEvent("output", "{\"category\":" + q(category) + ",\"output\":" + q(chunk) + "}");
                    }
                }
            } catch (IOException ignored) {}
        }, "dap-" + category).start();
    }

    static void eventLoop() {
        EventQueue q = vm.eventQueue();
        try {
            while (true) {
                EventSet set = q.remove();
                boolean stopHere = false;
                String stopReason = "breakpoint";
                ThreadReference hitThread = null;
                for (Event e : set) {
                    if (e instanceof ClassPrepareEvent) {
                        synchronized (JdiDap.class) { applyBreakpoints(); }
                    } else if (e instanceof BreakpointEvent) {
                        hitThread = ((BreakpointEvent) e).thread();
                        stopReason = "breakpoint";
                        stopHere = true;
                    } else if (e instanceof StepEvent) {
                        StepEvent se = (StepEvent) e;
                        if (userLine(se.location()) > 0) {
                            synchronized (JdiDap.class) { clearSteps(); }
                            hitThread = se.thread();
                            stopReason = "step";
                            stopHere = true;
                        }
                    } else if (e instanceof VMDeathEvent || e instanceof VMDisconnectEvent) {
                        sendEvent("exited", "{\"exitCode\":0}");
                        sendEvent("terminated", "{}");
                        return;
                    }
                }
                if (stopHere && hitThread != null) {
                    stoppedThread = hitThread;
                    frameRefs.clear();
                    sendEvent("stopped", "{\"reason\":" + q(stopReason) + ",\"threadId\":" + hitThread.uniqueID() + ",\"allThreadsStopped\":true}");
                } else {
                    set.resume();
                }
            }
        } catch (VMDisconnectedException | InterruptedException ignored) {
            sendEvent("terminated", "{}");
        }
    }

    static void applyBreakpoints() {
        if (vm == null || erm == null) return;
        for (BreakpointRequest bp : activeBps) {
            try { erm.deleteEventRequest(bp); } catch (Exception ignored) {}
        }
        activeBps.clear();
        for (ReferenceType rt : vm.allClasses()) {
            try {
                if (!userFile.equals(rt.sourceName())) continue;
                for (int ul : wantedUserLines) {
                    List<Location> locs = rt.locationsOfLine(ul + off);
                    if (!locs.isEmpty()) {
                        BreakpointRequest bp = erm.createBreakpointRequest(locs.get(0));
                        bp.setSuspendPolicy(EventRequest.SUSPEND_ALL);
                        bp.enable();
                        activeBps.add(bp);
                    }
                }
            } catch (AbsentInformationException ignored) {}
        }
    }

    static void clearSteps() {
        if (erm == null) return;
        for (StepRequest sr : activeSteps) {
            try { erm.deleteEventRequest(sr); } catch (Exception ignored) {}
        }
        activeSteps.clear();
    }

    static void stepVm(String raw, int depthKind) {
        clearSteps();
        ThreadReference t = findThread(extractLong(raw, "\"threadId\"", -1));
        if (t != null && erm != null) {
            StepRequest sr = erm.createStepRequest(t, StepRequest.STEP_LINE, depthKind);
            for (String ex : EXCLUDE) sr.addClassExclusionFilter(ex);
            sr.setSuspendPolicy(EventRequest.SUSPEND_ALL);
            sr.enable();
            activeSteps.add(sr);
        }
        resumeVm();
    }

    static void resumeVm() {
        stoppedThread = null;
        frameRefs.clear();
        if (vm != null) vm.resume();
    }

    static void shutdownVm() {
        if (vm != null) {
            try { vm.exit(0); } catch (Exception ignored) {}
        }
    }

    static ThreadReference findThread(long id) {
        if (vm == null) return null;
        if (id > 0) {
            for (ThreadReference t : vm.allThreads()) if (t.uniqueID() == id) return t;
        }
        if (stoppedThread != null) return stoppedThread;
        for (ThreadReference t : vm.allThreads()) if (!isSystemThread(t) && t.isSuspended()) return t;
        return null;
    }

    static boolean isSystemThread(ThreadReference t) {
        String name = t.name();
        return name.startsWith("Reference Handler") || name.startsWith("Finalizer") || name.startsWith("Signal Dispatcher") || name.startsWith("Common-Cleaner") || name.startsWith("Notification Thread");
    }

    static int userLine(Location loc) {
        try {
            if (loc == null || !userFile.equals(loc.sourceName())) return -1;
        } catch (AbsentInformationException e) {
            return -1;
        }
        int l = loc.lineNumber() - off;
        return l >= 1 && l <= n ? l : -1;
    }

    static String methodName(Method m) {
        String name = m.name();
        if (name.equals("<init>")) return m.declaringType().name().replaceAll(".*[.$]", "");
        return name;
    }

    static List<String[]> readFrameVars(StackFrame f) {
        List<String[]> out = new ArrayList<>();
        try {
            for (LocalVariable v : f.visibleVariables()) {
                Value val = f.getValue(v);
                out.add(new String[]{v.name(), fmt(val, 0), v.typeName()});
            }
        } catch (AbsentInformationException ignored) {}
        ObjectReference self = f.thisObject();
        if (self != null) {
            for (Field fld : self.referenceType().allFields()) {
                if (fld.isSynthetic()) continue;
                out.add(new String[]{"this." + fld.name(), fmt(self.getValue(fld), 0), fld.typeName()});
            }
        }
        return out;
    }

    static String evalSimple(String expr, int frameId) {
        if (expr == null) return "null";
        expr = expr.trim();
        FrameRef fr = frameRefs.get(frameId);
        try {
            StackFrame f = null;
            if (fr != null && fr.thread.isSuspended()) f = fr.thread.frame(fr.depth);
            else if (stoppedThread != null && stoppedThread.isSuspended() && stoppedThread.frameCount() > 0) f = stoppedThread.frame(0);
            if (f == null) return "<未暂停>";
            for (String[] kv : readFrameVars(f)) {
                if (kv[0].equals(expr) || kv[0].equals("this." + expr)) return kv[1];
            }
        } catch (Exception ignored) {}
        return "<无法求值: " + expr + ">";
    }

    static String fmt(Value v, int depth) {
        if (v == null) return "null";
        if (v instanceof BooleanValue || v instanceof ByteValue || v instanceof ShortValue || v instanceof IntegerValue || v instanceof LongValue || v instanceof FloatValue || v instanceof DoubleValue) return v.toString();
        if (v instanceof CharValue) return "'" + ((CharValue) v).value() + "'";
        if (v instanceof StringReference) return q(((StringReference) v).value());
        if (v instanceof ArrayReference) {
            ArrayReference arr = (ArrayReference) v;
            int len = arr.length(), show = Math.min(len, 12);
            List<String> items = new ArrayList<>();
            for (int i = 0; i < show; i++) items.add(fmt(arr.getValue(i), depth + 1));
            if (len > show) items.add("…");
            return "[" + String.join(", ", items) + "]";
        }
        if (v instanceof ObjectReference) {
            ObjectReference obj = (ObjectReference) v;
            ReferenceType rt = obj.referenceType();
            String tn = rt.name();
            Field box = rt.fieldByName("value");
            if (tn.startsWith("java.lang.") && box != null) return fmt(obj.getValue(box), depth);
            if (tn.endsWith("ListNode")) return fmtListNode(obj);
            if (depth >= 2) return rt.name().replaceAll(".*[.$]", "") + "{…}";
            List<String> fields = new ArrayList<>();
            for (Field fld : rt.fields()) {
                if (fld.isStatic() || fld.isSynthetic()) continue;
                fields.add(fld.name() + "=" + fmt(obj.getValue(fld), depth + 1));
                if (fields.size() >= 6) break;
            }
            return rt.name().replaceAll(".*[.$]", "") + "{" + String.join(", ", fields) + "}";
        }
        return v.toString();
    }

    static String fmtListNode(ObjectReference head) {
        List<String> vals = new ArrayList<>();
        ObjectReference cur = head;
        int steps = 0;
        while (cur != null && steps++ < 12) {
            Field vf = cur.referenceType().fieldByName("val");
            Field nf = cur.referenceType().fieldByName("next");
            vals.add(vf != null ? fmt(cur.getValue(vf), 3) : "?");
            Value nv = nf != null ? cur.getValue(nf) : null;
            cur = nv instanceof ObjectReference ? (ObjectReference) nv : null;
        }
        if (cur != null) vals.add("…");
        return "ListNode(" + String.join(" -> ", vals) + ")";
    }

    static String q(String s) {
        if (s == null) return "null";
        StringBuilder b = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
                    else b.append(c);
            }
        }
        return b.append("\"").toString();
    }

    static String extractString(String json, String key) {
        int i = json.indexOf(key);
        if (i < 0) return null;
        int colon = json.indexOf(':', i + key.length());
        if (colon < 0) return null;
        int q1 = json.indexOf('"', colon + 1);
        if (q1 < 0) return null;
        StringBuilder out = new StringBuilder();
        for (int k = q1 + 1; k < json.length(); k++) {
            char c = json.charAt(k);
            if (c == '\\' && k + 1 < json.length()) {
                char nx = json.charAt(++k);
                out.append(nx == 'n' ? '\n' : nx == 'r' ? '\r' : nx == 't' ? '\t' : nx);
            } else if (c == '"') {
                return out.toString();
            } else {
                out.append(c);
            }
        }
        return null;
    }

    static int extractInt(String json, String key, int def) {
        return (int) extractLong(json, key, def);
    }

    static long extractLong(String json, String key, long def) {
        int i = json.indexOf(key);
        if (i < 0) return def;
        int colon = json.indexOf(':', i + key.length());
        if (colon < 0) return def;
        int k = colon + 1;
        while (k < json.length() && Character.isWhitespace(json.charAt(k))) k++;
        int start = k;
        if (k < json.length() && json.charAt(k) == '-') k++;
        while (k < json.length() && Character.isDigit(json.charAt(k))) k++;
        if (k == start || (k == start + 1 && json.charAt(start) == '-')) return def;
        try { return Long.parseLong(json.substring(start, k)); } catch (NumberFormatException e) { return def; }
    }

    static List<Integer> extractBreakpointLines(String json) {
        List<Integer> out = new ArrayList<>();
        int idx = json.indexOf("\"breakpoints\"");
        if (idx < 0) return out;
        int arrStart = json.indexOf('[', idx);
        int arrEnd = json.indexOf(']', arrStart);
        if (arrStart < 0 || arrEnd < 0) return out;
        String sub = json.substring(arrStart, arrEnd);
        int pos = 0;
        while (true) {
            int lKey = sub.indexOf("\"line\"", pos);
            if (lKey < 0) break;
            int lineVal = extractInt(sub.substring(lKey), "\"line\"", -1);
            if (lineVal > 0) out.add(lineVal);
            pos = lKey + 6;
        }
        return out;
    }
}
