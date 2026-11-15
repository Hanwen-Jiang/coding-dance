var reverseList = function(head) {
    if (!head || !head.next) {                  //@base
        return head;                            //@base
    }
    const newHead = reverseList(head.next);     //@down
    head.next.next = head;                      // 让后一个节点指回自己 //@back
    head.next = null;                           //@cut
    return newHead;                             //@ret
};
