// Java 调试：用 JDI 启动程序、一行一行单步，停在用户代码里就记下行号、调用栈、变量；函数返回、抛异常也各记一步。
// 记录的格式和网站浏览器里的执行记录一样（site/lib/practice/types.ts 的 PracticeTrace）。
// 读变量只读字段，不在被调试的程序里调用任何方法（toString 之类），不会改变程序的行为。
// 用法：java -cp <本目录> JdiTrace <记录输出> <标准输入> <标准输出> <标准错误> <用户文件名> <行号偏移> <用户代码行数> <最多步数> <输出前缀字符数> <classpath> <主类> [参数…]
import com.sun.jdi.*;
import com.sun.jdi.connect.*;
import com.sun.jdi.event.*;
import com.sun.jdi.request.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

public class JdiTrace {
    static String userFile, mainClass;
    static int off, n, limit;
    static long outSkip;
    static final List<String> steps = new ArrayList<>();
    static long bytes = 0;
    static boolean full = false;
    static final AtomicLong outChars = new AtomicLong();
    static final String[] EXCLUDE = {"java.*", "javax.*", "sun.*", "jdk.*", "com.sun.*", "H", "HR"};

    public static void main(String[] a) throws Exception {
        String tracePath = a[0], inPath = a[1], outPath = a[2], errPath = a[3];
        userFile = a[4];
        off = Integer.parseInt(a[5]);
        n = Integer.parseInt(a[6]);
        limit = Integer.parseInt(a[7]);
        outSkip = Long.parseLong(a[8]);
        String cp = a[9];
        mainClass = a[10];
        StringBuilder mainArg = new StringBuilder(mainClass);
        for (int i = 11; i < a.length; i++) mainArg.append(' ').append(a[i]);

        LaunchingConnector lc = Bootstrap.virtualMachineManager().defaultConnector();
        Map<String, Connector.Argument> args = lc.defaultArguments();
        args.get("main").setValue(mainArg.toString());
        args.get("options").setValue("-cp " + cp + " -Xss64m -Xmx512m -XX:+UseSerialGC -XX:-UsePerfData -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8");
        VirtualMachine vm = lc.launch(args);
        Process p = vm.process();
        Thread tin = new Thread(() -> {
            try (OutputStream o = p.getOutputStream()) { Files.copy(Paths.get(inPath), o); } catch (IOException ignored) {}
        });
        Thread tout = pump(p.getInputStream(), outPath, true), terr = pump(p.getErrorStream(), errPath, false);
        tin.start(); tout.start(); terr.start();

        EventRequestManager erm = vm.eventRequestManager();
        ClassPrepareRequest cpr = erm.createClassPrepareRequest();
        cpr.addClassFilter(mainClass);
        cpr.enable();
        EventQueue q = vm.eventQueue();
        boolean done = false;
        try {
            while (!done) {
                EventSet set = q.remove();
                for (Event e : set) {
                    if (e instanceof ClassPrepareEvent) {
                        ReferenceType t = ((ClassPrepareEvent) e).referenceType();
                        for (Method m : t.methodsByName("main")) {
                            if (m.location() == null) continue;
                            BreakpointRequest bp = erm.createBreakpointRequest(m.location());
                            bp.setSuspendPolicy(EventRequest.SUSPEND_EVENT_THREAD);
                            bp.enable();
                        }
                    } else if (e instanceof BreakpointEvent) {
                        erm.deleteEventRequest(e.request());
                        start(erm, ((BreakpointEvent) e).thread());
                    } else if (e instanceof StepEvent) {
                        onStep((StepEvent) e);
                    } else if (e instanceof MethodExitEvent) {
                        onExit((MethodExitEvent) e);
                    } else if (e instanceof ExceptionEvent) {
                        onException((ExceptionEvent) e);
                    } else if (e instanceof VMDeathEvent || e instanceof VMDisconnectEvent) {
                        done = true;
                    }
                }
                if (full && !done) {
                    try { vm.exit(1); } catch (Exception ignored) {}
                    break;
                }
                if (!done) set.resume();
            }
        } catch (VMDisconnectedException ignored) {
        }
        tout.join(3000);
        terr.join(3000);
        StringBuilder sb = new StringBuilder("{\"steps\":[");
        for (int i = 0; i < steps.size(); i++) sb.append(i > 0 ? "," : "").append(steps.get(i));
        sb.append("],\"truncated\":").append(full).append(",\"limit\":").append(limit).append("}");
        Files.write(Paths.get(tracePath), sb.toString().getBytes(StandardCharsets.UTF_8));
        System.exit(0);
    }

    static void start(EventRequestManager erm, ThreadReference t) {
        StepRequest s = erm.createStepRequest(t, StepRequest.STEP_LINE, StepRequest.STEP_INTO);
        for (String x : EXCLUDE) s.addClassExclusionFilter(x);
        s.setSuspendPolicy(EventRequest.SUSPEND_EVENT_THREAD);
        s.enable();
        MethodExitRequest m = erm.createMethodExitRequest();
        for (String x : EXCLUDE) m.addClassExclusionFilter(x);
        m.addThreadFilter(t);
        m.setSuspendPolicy(EventRequest.SUSPEND_EVENT_THREAD);
        m.enable();
        ExceptionRequest x = erm.createExceptionRequest(null, true, true);
        x.addThreadFilter(t);
        x.setSuspendPolicy(EventRequest.SUSPEND_EVENT_THREAD);
        x.enable();
    }

    static Thread pump(InputStream in, String path, boolean count) {
        return new Thread(() -> {
            try (Reader r = new InputStreamReader(in, StandardCharsets.UTF_8); Writer w = new OutputStreamWriter(new FileOutputStream(path), StandardCharsets.UTF_8)) {
                char[] buf = new char[4096];
                for (int k; (k = r.read(buf)) > 0; ) {
                    w.write(buf, 0, k);
                    w.flush();
                    if (count) outChars.addAndGet(k);
                }
            } catch (IOException ignored) {}
        });
    }

    // —— 记录 ——
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
        if (name.startsWith("lambda$")) return "lambda";
        return name;
    }

    static void record(String event, int line, String fn, ThreadReference t, StackFrame f, String ret, String exc) {
        StringBuilder b = new StringBuilder("{\"line\":").append(line).append(",\"event\":").append(q(event)).append(",\"fn\":").append(q(fn)).append(",\"stack\":[");
        List<String> st = new ArrayList<>();
        try {
            for (StackFrame x : t.frames()) {
                int l = userLine(x.location());
                if (l > 0) st.add("[" + q(methodName(x.location().method())) + "," + l + "]");
            }
        } catch (IncompatibleThreadStateException ignored) {}
        Collections.reverse(st);
        b.append(String.join(",", st)).append("],\"vars\":[");
        if (f != null) {
            List<String> vs = new ArrayList<>();
            for (String[] v : vars(f)) vs.add("[" + q(v[0]) + "," + q(v[1]) + "]");
            b.append(String.join(",", vs));
        }
        b.append("],\"out\":").append(Math.max(0, outChars.get() - outSkip));
        if (ret != null) b.append(",\"ret\":").append(q(ret));
        if (exc != null) b.append(",\"exc\":").append(q(exc));
        b.append("}");
        String s = b.toString();
        steps.add(s);
        bytes += s.length();
        if (steps.size() >= limit || bytes > 600000) full = true;
    }

    /** 判题程序 new Solution() 走进的默认构造函数（行号是类声明那一行）不记 */
    static boolean implicit(Method m) {
        return m.isConstructor() && m.declaringType().name().equals("Solution");
    }

    static void onStep(StepEvent e) {
        if (full || implicit(e.location().method())) return;
        int line = userLine(e.location());
        if (line < 0) return;
        try {
            record("line", line, methodName(e.location().method()), e.thread(), e.thread().frame(0), null, null);
        } catch (IncompatibleThreadStateException ignored) {}
    }

    static void onExit(MethodExitEvent e) {
        if (full || implicit(e.method())) return;
        int line = userLine(e.location());
        if (line < 0) return;
        String ret = null;
        try {
            if (!"void".equals(e.method().returnTypeName())) ret = fmt(e.returnValue(), 0);
        } catch (Exception ignored) {}
        try {
            record("return", line, methodName(e.method()), e.thread(), e.thread().frame(0), ret, null);
        } catch (IncompatibleThreadStateException ignored) {}
    }

    static void onException(ExceptionEvent e) {
        if (full) return;
        // 在 JDK 里面抛出又在 JDK 里面接住的（类加载之类）不算
        Location c = e.catchLocation();
        if (c != null && userLine(c) < 0 && !c.declaringType().name().equals("JudgeMain") && !c.declaringType().name().equals(mainClass)) return;
        try {
            for (StackFrame f : e.thread().frames()) {
                int l = userLine(f.location());
                if (l < 0) continue;
                ObjectReference ex = e.exception();
                Value msg = field(ex, "detailMessage");
                String text = ex.referenceType().name() + (msg instanceof StringReference ? ": " + ((StringReference) msg).value() : "");
                record("exception", l, methodName(f.location().method()), e.thread(), null, null, text);
                return;
            }
        } catch (IncompatibleThreadStateException ignored) {}
    }

    static List<String[]> vars(StackFrame f) {
        List<String[]> out = new ArrayList<>();
        try {
            for (LocalVariable v : f.visibleVariables()) {
                out.add(new String[]{v.name(), fmt(f.getValue(v), 0)});
                if (out.size() >= 40) return out;
            }
        } catch (AbsentInformationException ignored) {}
        try {
            ObjectReference self = f.thisObject();
            if (self != null) for (Field fd : self.referenceType().visibleFields()) {
                if (fd.isStatic() || fd.isSynthetic()) continue;
                out.add(new String[]{"this." + fd.name(), fmt(self.getValue(fd), 0)});
                if (out.size() >= 40) break;
            }
        } catch (Exception ignored) {}
        return out;
    }

    // —— 值怎么显示：和浏览器里的风格一致（容器类带类型和长度，比如 ArrayList(3) [1, 2, 3]） ——
    static Value field(ObjectReference o, String name) {
        Field f = o.referenceType().fieldByName(name);
        return f == null ? null : o.getValue(f);
    }

    static int intField(ObjectReference o, String name) {
        Value v = field(o, name);
        return v instanceof IntegerValue ? ((IntegerValue) v).value() : 0;
    }

    static String q(String s) {
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
        return b.append('"').toString();
    }

    static String str(String s) {
        return q(s.length() > 60 ? s.substring(0, 59) + "…" : s);
    }

    static String seq(String tag, List<String> items, int size) {
        return (tag == null ? "" : tag + "(" + size + ") ") + "[" + String.join(", ", items) + (size > items.size() ? ", …" : "") + "]";
    }

    static String map(String tag, List<String> items, int size) {
        return tag + "(" + size + ") {" + String.join(", ", items) + (size > items.size() ? ", …" : "") + "}";
    }

    static String fmt(Value v, int depth) {
        try {
            return fmt0(v, depth);
        } catch (Exception e) {
            return "<无法显示>";
        }
    }

    static String fmt0(Value v, int depth) {
        if (v == null) return "null";
        if (v instanceof StringReference) return str(((StringReference) v).value());
        if (v instanceof CharValue) return "'" + ((CharValue) v).value() + "'";
        if (v instanceof PrimitiveValue) return v.toString();
        if (v instanceof ArrayReference) {
            ArrayReference ar = (ArrayReference) v;
            int len = ar.length();
            List<String> items = new ArrayList<>();
            if (depth >= 3) return "[…]";
            for (Value x : ar.getValues(0, Math.min(len, 12))) items.add(fmt(x, depth + 1));
            return seq(null, items, len);
        }
        ObjectReference o = (ObjectReference) v;
        String type = o.referenceType().name(), simple = type.replaceAll(".*[.$]", "");
        switch (type) {
            case "java.lang.Integer": case "java.lang.Long": case "java.lang.Double": case "java.lang.Float":
            case "java.lang.Short": case "java.lang.Byte": case "java.lang.Boolean": case "java.lang.Character":
                return fmt0(field(o, "value"), depth);
        }
        if (depth >= 3) return simple + "{…}";
        if (simple.equals("ListNode")) {
            List<String> out = new ArrayList<>();
            Set<Long> seen = new HashSet<>();
            ObjectReference p = o;
            while (p != null && out.size() < 12) {
                if (!seen.add(p.uniqueID())) { out.add("…（有环）"); return "ListNode(" + String.join(" → ", out) + ")"; }
                out.add(fmt(field(p, "val"), 3));
                Value nx = field(p, "next");
                p = nx instanceof ObjectReference ? (ObjectReference) nx : null;
            }
            if (p != null) out.add("…");
            return "ListNode(" + String.join(" → ", out) + ")";
        }
        if ((simple.equals("TreeNode") || simple.equals("Node")) && field(o, "val") != null) return simple + "(" + fmt(field(o, "val"), 3) + ")";
        switch (type) {
            case "java.util.ArrayList": case "java.util.Vector": case "java.util.Stack": {
                int size = type.equals("java.util.ArrayList") ? intField(o, "size") : intField(o, "elementCount");
                ArrayReference data = (ArrayReference) field(o, "elementData");
                List<String> items = new ArrayList<>();
                for (int i = 0; i < Math.min(size, 12); i++) items.add(fmt(data.getValue(i), depth + 1));
                return seq(simple, items, size);
            }
            case "java.util.LinkedList": {
                int size = intField(o, "size");
                List<String> items = new ArrayList<>();
                for (Value x = field(o, "first"); x instanceof ObjectReference && items.size() < 12; x = field((ObjectReference) x, "next"))
                    items.add(fmt(field((ObjectReference) x, "item"), depth + 1));
                return seq(simple, items, size);
            }
            case "java.util.ArrayDeque": {
                ArrayReference data = (ArrayReference) field(o, "elements");
                int head = intField(o, "head"), tail = intField(o, "tail"), len = data.length();
                int size = len == 0 ? 0 : (tail - head + len) % len;
                List<String> items = new ArrayList<>();
                for (int i = 0; i < Math.min(size, 12); i++) items.add(fmt(data.getValue((head + i) % len), depth + 1));
                return seq(simple, items, size);
            }
            case "java.util.PriorityQueue": {
                int size = intField(o, "size");
                ArrayReference data = (ArrayReference) field(o, "queue");
                List<String> items = new ArrayList<>();
                for (int i = 0; i < Math.min(size, 12); i++) items.add(fmt(data.getValue(i), depth + 1));
                return seq(simple, items, size);
            }
            case "java.util.HashMap": case "java.util.LinkedHashMap":
                return map(simple, entries(o, depth, false), intField(o, "size"));
            case "java.util.HashSet": case "java.util.LinkedHashSet": {
                ObjectReference m = (ObjectReference) field(o, "map");
                return seq(simple, entries(m, depth, true), intField(m, "size"));
            }
            case "java.util.TreeMap":
                return map(simple, treeEntries(o, depth, false), intField(o, "size"));
            case "java.util.TreeSet": {
                ObjectReference m = (ObjectReference) field(o, "m");
                return seq(simple, treeEntries(m, depth, true), intField(m, "size"));
            }
            case "java.lang.StringBuilder": case "java.lang.StringBuffer": {
                ArrayReference data = (ArrayReference) field(o, "value");
                int count = intField(o, "count");
                Value coder = field(o, "coder");
                boolean utf16 = coder instanceof ByteValue && ((ByteValue) coder).value() != 0;
                int chars = Math.min(count, 200);
                StringBuilder s = new StringBuilder();
                for (int i = 0; i < chars; i++) {
                    if (utf16) {
                        int lo = ((ByteValue) data.getValue(2 * i)).value() & 0xff, hi = ((ByteValue) data.getValue(2 * i + 1)).value() & 0xff;
                        s.append((char) (lo | (hi << 8)));
                    } else s.append((char) (((ByteValue) data.getValue(i)).value() & 0xff));
                }
                return simple + "(" + str(s.toString()) + ")";
            }
        }
        if (type.startsWith("java.") || type.startsWith("jdk.") || type.startsWith("sun.")) {
            Value k = field(o, "key"), val = field(o, "value");
            if (k != null || val != null) return fmt(k, depth + 1) + "=" + fmt(val, depth + 1);
            return simple;
        }
        // 用户自己的类：列出几个字段
        if (depth >= 1) return simple;
        List<String> parts = new ArrayList<>();
        for (Field fd : o.referenceType().visibleFields()) {
            if (fd.isStatic() || fd.isSynthetic()) continue;
            if (parts.size() >= 6) { parts.add("…"); break; }
            parts.add(fd.name() + ": " + fmt(o.getValue(fd), depth + 1));
        }
        return simple + " {" + String.join(", ", parts) + "}";
    }

    /** HashMap 的条目：LinkedHashMap 按插入顺序（head → after），HashMap 按桶 */
    static List<String> entries(ObjectReference m, int depth, boolean keysOnly) {
        List<String> items = new ArrayList<>();
        Value head = field(m, "head");
        if (m.referenceType().name().equals("java.util.LinkedHashMap") && head instanceof ObjectReference) {
            for (Value e = head; e instanceof ObjectReference && items.size() < 12; e = field((ObjectReference) e, "after")) items.add(entry((ObjectReference) e, depth, keysOnly));
            return items;
        }
        Value table = field(m, "table");
        if (!(table instanceof ArrayReference)) return items;
        for (Value b : ((ArrayReference) table).getValues()) {
            for (Value e = b; e instanceof ObjectReference; e = field((ObjectReference) e, "next")) {
                if (items.size() >= 12) return items;
                items.add(entry((ObjectReference) e, depth, keysOnly));
            }
        }
        return items;
    }

    static List<String> treeEntries(ObjectReference m, int depth, boolean keysOnly) {
        List<String> items = new ArrayList<>();
        Deque<ObjectReference> stack = new ArrayDeque<>();
        Value cur = field(m, "root");
        while ((cur instanceof ObjectReference || !stack.isEmpty()) && items.size() < 12) {
            while (cur instanceof ObjectReference) { stack.push((ObjectReference) cur); cur = field((ObjectReference) cur, "left"); }
            ObjectReference node = stack.pop();
            items.add(entry(node, depth, keysOnly));
            cur = field(node, "right");
        }
        return items;
    }

    static String entry(ObjectReference e, int depth, boolean keysOnly) {
        String k = fmt(field(e, "key"), depth + 1);
        return keysOnly ? k : k + "=" + fmt(field(e, "value"), depth + 1);
    }
}
