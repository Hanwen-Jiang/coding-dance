function detectCycle(head: ListNode | null): ListNode | null {
    const seen = new Set<ListNode>();               //@init
    while (head && !seen.has(head)) {               //@add,found,none
        seen.add(head);                             //@add
        head = head.next;                           //@add
    }
    return head;                                    //@found,none
}
