// 力扣 Java 环境里现成的两个节点类型
class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}

class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}

class H {
    static ListNode list(int[] vals) {
        ListNode dummy = new ListNode(), cur = dummy;
        for (int v : vals) { cur.next = new ListNode(v); cur = cur.next; }
        return dummy.next;
    }

    // 层序数组，null 表示空位
    static TreeNode tree(Integer[] vals) {
        if (vals.length == 0 || vals[0] == null) return null;
        TreeNode root = new TreeNode(vals[0]);
        ArrayList<TreeNode> q = new ArrayList<>();
        q.add(root);
        int i = 1;
        for (int h = 0; i < vals.length && h < q.size(); h++) {
            TreeNode node = q.get(h);
            if (vals[i] != null) { node.left = new TreeNode(vals[i]); q.add(node.left); }
            i++;
            if (i < vals.length) {
                if (vals[i] != null) { node.right = new TreeNode(vals[i]); q.add(node.right); }
                i++;
            }
        }
        return root;
    }

    static String json(Object o) {
        StringBuilder sb = new StringBuilder();
        write(sb, o);
        return sb.toString();
    }

    static void quote(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' || c == '\\') sb.append('\\').append(c);
            else if (c == '\n') sb.append("\\n");
            else if (c == '\r') sb.append("\\r");
            else if (c == '\t') sb.append("\\t");
            else if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
            else sb.append(c);
        }
        sb.append('"');
    }

    static void write(StringBuilder sb, Object o) {
        if (o == null) { sb.append("null"); return; }
        if (o instanceof Boolean || o instanceof Integer || o instanceof Long || o instanceof Short || o instanceof Byte) { sb.append(o); return; }
        if (o instanceof Double || o instanceof Float) {
            double d = ((Number) o).doubleValue();
            sb.append(Double.isNaN(d) || Double.isInfinite(d) ? "null" : String.valueOf(d));
            return;
        }
        if (o instanceof Character || o instanceof String) { quote(sb, String.valueOf(o)); return; }
        if (o instanceof ListNode) {
            sb.append('[');
            int n = 0;
            for (ListNode p = (ListNode) o; p != null && n < 100000; p = p.next, n++) { if (n > 0) sb.append(','); sb.append(p.val); }
            sb.append(']');
            return;
        }
        if (o instanceof TreeNode) {
            ArrayList<TreeNode> q = new ArrayList<>();
            ArrayList<Integer> out = new ArrayList<>();
            q.add((TreeNode) o);
            for (int h = 0; h < q.size(); h++) {
                TreeNode t = q.get(h);
                if (t == null) { out.add(null); continue; }
                out.add(t.val); q.add(t.left); q.add(t.right);
            }
            while (!out.isEmpty() && out.get(out.size() - 1) == null) out.remove(out.size() - 1);
            write(sb, out);
            return;
        }
        if (o instanceof int[]) { int[] a = (int[]) o; sb.append('['); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(','); sb.append(a[i]); } sb.append(']'); return; }
        if (o instanceof long[]) { long[] a = (long[]) o; sb.append('['); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(','); sb.append(a[i]); } sb.append(']'); return; }
        if (o instanceof double[]) { double[] a = (double[]) o; sb.append('['); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(','); write(sb, a[i]); } sb.append(']'); return; }
        if (o instanceof boolean[]) { boolean[] a = (boolean[]) o; sb.append('['); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(','); sb.append(a[i]); } sb.append(']'); return; }
        if (o instanceof char[]) { char[] a = (char[]) o; sb.append('['); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(','); quote(sb, String.valueOf(a[i])); } sb.append(']'); return; }
        if (o instanceof Object[]) { Object[] a = (Object[]) o; sb.append('['); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(','); write(sb, a[i]); } sb.append(']'); return; }
        if (o instanceof Collection) {
            sb.append('[');
            boolean first = true;
            for (Object x : (Collection<?>) o) { if (!first) sb.append(','); first = false; write(sb, x); }
            sb.append(']');
            return;
        }
        quote(sb, String.valueOf(o));
    }
}
