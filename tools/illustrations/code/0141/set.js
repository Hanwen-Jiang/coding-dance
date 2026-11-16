var hasCycle = function(head) {
    const seen = new Set();                         //@init
    while (head && !seen.has(head)) {               //@add,found,none
        seen.add(head);                             //@add
        head = head.next;                           //@add
    }
    return head !== null;                           //@found,none
};
