var removeNthFromEnd = function(head, n) {
    // 返回 node 是倒数第几个
    const rec = (node) => {
        if (!node) {                        //@base
            return 0;                       //@base
        }
        const k = rec(node.next) + 1;       //@down,count
        if (k === n + 1) {                  //@del
            node.next = node.next.next;     //@del
        }
        return k;                           //@ret
    };
    const dummy = new ListNode(0, head);    //@start
    rec(dummy);                             //@start
    return dummy.next;                      //@done
};
