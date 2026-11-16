var getIntersectionNode = function(headA, headB) {
    const seen = new Set();                         //@init
    while (headA) {                                 //@addA
        seen.add(headA);                            //@addA
        headA = headA.next;                         //@addA
    }
    while (headB && !seen.has(headB)) {             //@walkB,found,none
        headB = headB.next;                         //@walkB
    }
    return headB;                                   //@found,none
};
