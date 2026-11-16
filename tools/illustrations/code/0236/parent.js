var lowestCommonAncestor = function(root, p, q) {
    const parent = new Map([[root, null]]);         //@init
    const stack = [root];                           //@init
    while (!parent.has(p) || !parent.has(q)) {      //@parent
        const node = stack.pop();                   //@parent
        for (const child of [node.left, node.right]) {  //@parent
            if (child) {                            //@parent
                parent.set(child, node);            //@parent
                stack.push(child);                  //@parent
            }
        }
    }
    const ancestors = new Set();                    //@up
    while (p) {                                     // p 和它所有的祖先 //@up
        ancestors.add(p);                           //@up
        p = parent.get(p);                          //@up
    }
    while (!ancestors.has(q)) {                     // q 往上走，第一个碰到的就是答案 //@climb
        q = parent.get(q);                          //@climb
    }
    return q;                                       //@done
};
