function hasCycle(head: ListNode | null): boolean {
    const seen = new Set<ListNode>();               //@init
    while (head && !seen.has(head)) {               //@add,found,none
        seen.add(head);                             //@add
        head = head.next;                           //@add
    }
    return head !== null;                           //@found,none
}
