/**
 * 力扣已经定义好了 TreeNode：
 * public class TreeNode {
 *     int val;
 *     TreeNode left;
 *     TreeNode right;
 *     TreeNode() {}
 *     TreeNode(int val) { this.val = val; }
 *     TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
 * }
 */
class Solution {
    public TreeNode buildTree(String data) {
        String[] vals = data.isEmpty() ? new String[0] : data.split(",");   // "1,2,null" -> ["1", "2", "null"] //@init
        if (vals.length == 0 || vals[0].equals("null")) {   //@init
            return null;                                    //@init
        }
        TreeNode root = new TreeNode(Integer.parseInt(vals[0]));    //@root
        Deque<TreeNode> q = new ArrayDeque<>();             // 还没接孩子的节点 //@root
        q.offer(root);                                      //@root
        int i = 1;
        while (!q.isEmpty() && i < vals.length) {           //@take
            TreeNode node = q.poll();                       // 给它接左、右孩子 //@take
            if (!vals[i].equals("null")) {                  //@left
                node.left = new TreeNode(Integer.parseInt(vals[i]));    //@left
                q.offer(node.left);                         //@left
            }
            i++;                                            //@left
            if (i < vals.length && !vals[i].equals("null")) {   //@right
                node.right = new TreeNode(Integer.parseInt(vals[i]));   //@right
                q.offer(node.right);                        //@right
            }
            i++;                                            //@right
        }
        return root;                                        //@done
    }
}
