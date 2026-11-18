// 判题程序的 C# 部分（单独一个文件，和用户代码一起编译）：力扣 C# 环境里现成的两个节点类型、建参数、把结果写成 JSON
public class ListNode {
    public int val;
    public ListNode next;
    public ListNode(int val = 0, ListNode next = null) { this.val = val; this.next = next; }
}

public class TreeNode {
    public int val;
    public TreeNode left;
    public TreeNode right;
    public TreeNode(int val = 0, TreeNode left = null, TreeNode right = null) { this.val = val; this.left = left; this.right = right; }
}

static class JH {
    // 本用例建出的节点：要按「是不是同一个节点」判的题用（见 judge/util.js 里的类型说明）
    public static readonly List<ListNode> Nodes = new List<ListNode>();
    public static TreeNode LastTree;

    public static void Reset() { Nodes.Clear(); LastTree = null; }

    public static ListNode MkList(int[] v) {
        ListNode dummy = new ListNode(), cur = dummy;
        foreach (int x in v) { cur.next = new ListNode(x); cur = cur.next; Nodes.Add(cur); }
        return dummy.next;
    }

    public static ListNode MkCycle(int[] v, int pos) {
        int s = Nodes.Count;
        ListNode head = MkList(v);
        if (pos >= 0 && v.Length > 0) Nodes[s + v.Length - 1].next = Nodes[s + pos];
        return head;
    }

    public static ListNode MkJoin(int[] v, int k) {
        ListNode tail = k >= 0 ? Nodes[k] : null;
        int s = Nodes.Count;
        ListNode head = MkList(v);
        if (v.Length == 0) return tail;
        Nodes[s + v.Length - 1].next = tail;
        return head;
    }

    public static object Index(ListNode n) {
        if (n == null) return null;
        for (int i = 0; i < Nodes.Count; i++) if (ReferenceEquals(Nodes[i], n)) return i;
        return "不是输入里的节点";
    }

    public static TreeNode MkTree(int?[] v) {
        LastTree = null;
        if (v.Length == 0 || v[0] == null) return null;
        var root = new TreeNode(v[0].Value);
        var q = new List<TreeNode> { root };
        int i = 1;
        for (int h = 0; i < v.Length && h < q.Count; h++) {
            var node = q[h];
            if (v[i] != null) { node.left = new TreeNode(v[i].Value); q.Add(node.left); }
            i++;
            if (i < v.Length) {
                if (v[i] != null) { node.right = new TreeNode(v[i].Value); q.Add(node.right); }
                i++;
            }
        }
        LastTree = root;
        return root;
    }

    public static TreeNode Find(int v) {
        var st = new Stack<TreeNode>();
        if (LastTree != null) st.Push(LastTree);
        while (st.Count > 0) {
            var t = st.Pop();
            if (t.val == v) return t;
            if (t.left != null) st.Push(t.left);
            if (t.right != null) st.Push(t.right);
        }
        return null;
    }

    public static object Val(TreeNode n) => n == null ? null : (object)n.val;

    public static string Json(object o) { var sb = new StringBuilder(); W(sb, o); return sb.ToString(); }

    public static string Q(string s) { var sb = new StringBuilder(); Q(sb, s); return sb.ToString(); }

    static void Q(StringBuilder sb, string s) {
        sb.Append('"');
        foreach (char c in s) {
            if (c == '"' || c == '\\') sb.Append('\\').Append(c);
            else if (c == '\n') sb.Append("\\n");
            else if (c == '\r') sb.Append("\\r");
            else if (c == '\t') sb.Append("\\t");
            else if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
            else sb.Append(c);
        }
        sb.Append('"');
    }

    static void W(StringBuilder sb, object o) {
        var inv = System.Globalization.CultureInfo.InvariantCulture;
        switch (o) {
            case null: sb.Append("null"); return;
            case bool b: sb.Append(b ? "true" : "false"); return;
            case int or long or short or byte or uint or ulong: sb.Append(System.Convert.ToString(o, inv)); return;
            case double d: sb.Append(double.IsFinite(d) ? d.ToString("R", inv) : "null"); return;
            case float f: sb.Append(float.IsFinite(f) ? ((double)f).ToString("R", inv) : "null"); return;
            case string s: Q(sb, s); return;
            case char c: Q(sb, c.ToString()); return;
            case ListNode l: {
                sb.Append('[');
                int n = 0;
                for (var p = l; p != null && n < 100000; p = p.next, n++) { if (n > 0) sb.Append(','); sb.Append(p.val); }
                sb.Append(']');
                return;
            }
            case TreeNode t: {
                var q = new List<TreeNode> { t };
                var vals = new List<object>();
                for (int h = 0; h < q.Count && q.Count < 400000; h++) {
                    if (q[h] == null) { vals.Add(null); continue; }
                    vals.Add(q[h].val); q.Add(q[h].left); q.Add(q[h].right);
                }
                while (vals.Count > 0 && vals[vals.Count - 1] == null) vals.RemoveAt(vals.Count - 1);
                W(sb, vals);
                return;
            }
            case System.Collections.IEnumerable e: {
                sb.Append('[');
                bool first = true;
                foreach (var x in e) { if (!first) sb.Append(','); first = false; W(sb, x); }
                sb.Append(']');
                return;
            }
            default: Q(sb, o.ToString()); return;
        }
    }
}
