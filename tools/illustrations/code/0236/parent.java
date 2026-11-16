class Solution {
    public TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
        Map<TreeNode, TreeNode> parent = new HashMap<>();   //@init
        parent.put(root, null);                         //@init
        Deque<TreeNode> stack = new ArrayDeque<>();     //@init
        stack.push(root);                               //@init
        while (!parent.containsKey(p) || !parent.containsKey(q)) {  //@parent
            TreeNode node = stack.pop();                //@parent
            for (TreeNode child : new TreeNode[]{node.left, node.right}) {  //@parent
                if (child != null) {                    //@parent
                    parent.put(child, node);            //@parent
                    stack.push(child);                  //@parent
                }
            }
        }
        Set<TreeNode> ancestors = new HashSet<>();      //@up
        while (p != null) {                             // p 和它所有的祖先 //@up
            ancestors.add(p);                           //@up
            p = parent.get(p);                          //@up
        }
        while (!ancestors.contains(q)) {                // q 往上走，第一个碰到的就是答案 //@climb
            q = parent.get(q);                          //@climb
        }
        return q;                                       //@done
    }
}
