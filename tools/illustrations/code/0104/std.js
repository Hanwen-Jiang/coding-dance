var maxDepth = function(root) {
    if (!root) {                        //@base
        return 0;                       //@base
    }
    return Math.max(maxDepth(root.left), maxDepth(root.right)) + 1;    //@down,depth
};
