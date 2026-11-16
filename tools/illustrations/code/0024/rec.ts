function swapPairs(head: ListNode | null): ListNode | null {
    if (!head || !head.next) {                  //@base
        return head;                            //@base
    }
    const nxt = head.next;                      //@call
    head.next = swapPairs(nxt.next);            //@call,swap
    nxt.next = head;                            //@swap
    return nxt;                                 //@swap,done
}
