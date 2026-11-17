var sortList = function(head) {
    if (!head || !head.next) {                  //@base
        return head;                            //@base
    }
    let slow = head, fast = head.next;          // fast 先走一步，slow 停在前半段末尾 //@mid
    while (fast && fast.next) {                 //@mid
        slow = slow.next;                       //@mid
        fast = fast.next.next;                  //@mid
    }
    const mid = slow.next;                      // 从中间断开 //@cut
    slow.next = null;                           //@cut
    let left = sortList(head), right = sortList(mid);   //@rec
    const dummy = new ListNode();               //@merge
    let cur = dummy;                            //@merge
    while (left && right) {                     // 合并两个有序链表 //@merge
        if (left.val <= right.val) {            //@merge
            cur.next = left;                    //@merge
            left = left.next;                   //@merge
        } else {
            cur.next = right;                   //@merge
            right = right.next;                 //@merge
        }
        cur = cur.next;                         //@merge
    }
    cur.next = left || right;                   //@merge
    return dummy.next;                          //@merge,done
};
