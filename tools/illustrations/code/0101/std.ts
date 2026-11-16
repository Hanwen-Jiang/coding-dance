function isSymmetric(root: TreeNode | null): boolean {
    // a 和 b 两棵子树是否互为镜像
    const check = (a: TreeNode | null, b: TreeNode | null): boolean => {
        if (!a && !b) {                         //@both
            return true;                        //@both
        }
        if (!a || !b || a.val !== b.val) {      //@diff
            return false;                       //@diff
        }
        return check(a.left, b.right) && check(a.right, b.left);   //@same
    };
    return check(root!.left, root!.right);      //@start
}
