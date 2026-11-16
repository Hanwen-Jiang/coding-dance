function getIntersectionNode(headA: ListNode | null, headB: ListNode | null): ListNode | null {
    const seen = new Set<ListNode>();               //@init
    while (headA) {                                 //@addA
        seen.add(headA);                            //@addA
        headA = headA.next;                         //@addA
    }
    while (headB && !seen.has(headB)) {             //@walkB,found,none
        headB = headB.next;                         //@walkB
    }
    return headB;                                   //@found,none
}
