var largestValues = function(root) {
    const res = [];
    let q = root ? [root] : [];                 //@init
    while (q.length) {
        let best = q[0].val;                    //@level
        const next = [];                        // 下一层的节点先放这里 //@level
        for (const node of q) {                 // 这一层有 q.length 个节点 //@level
            best = Math.max(best, node.val);    //@pop
            if (node.left) {                    //@push
                next.push(node.left);           //@push
            }
            if (node.right) {                   //@push
                next.push(node.right);          //@push
            }
        }
        res.push(best);                         //@end
        q = next;                               //@end
    }
    return res;                                 //@done
};
