var removeNthFromEnd = function(head, n) {
    const dummy = new ListNode(0, head);    //@init
    let slow = dummy, fast = dummy;         //@init
    for (let i = 0; i < n; i++) {           // fast 先走 n 步 //@ahead
        fast = fast.next;                   //@ahead
    }
    while (fast.next) {                     // 一起走，直到 fast 在最后一个节点 //@loop
        slow = slow.next;                   //@walk
        fast = fast.next;                   //@walk
    }
    slow.next = slow.next.next;             // 跳过要删的节点 //@del
    return dummy.next;                      //@done
};
