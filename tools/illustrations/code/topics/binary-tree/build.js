/**
 * 力扣已经定义好了 TreeNode：
 * function TreeNode(val, left, right) {
 *     this.val = (val === undefined ? 0 : val);
 *     this.left = (left === undefined ? null : left);
 *     this.right = (right === undefined ? null : right);
 * }
 */
var buildTree = function(data) {
    const vals = data ? data.split(",") : [];       // "1,2,null" -> ["1", "2", "null"] //@init
    if (!vals.length || vals[0] === "null") {       //@init
        return null;                                //@init
    }
    const root = new TreeNode(Number(vals[0]));     //@root
    const q = [root];                               // 还没接孩子的节点 //@root
    let head = 0, i = 1;                            // head 是队头的下标，出队不用真的删 //@root
    while (head < q.length && i < vals.length) {    //@take
        const node = q[head++];                     // 给它接左、右孩子 //@take
        if (vals[i] !== "null") {                   //@left
            node.left = new TreeNode(Number(vals[i]));  //@left
            q.push(node.left);                      //@left
        }
        i++;                                        //@left
        if (i < vals.length && vals[i] !== "null") {    //@right
            node.right = new TreeNode(Number(vals[i])); //@right
            q.push(node.right);                     //@right
        }
        i++;                                        //@right
    }
    return root;                                    //@done
};
