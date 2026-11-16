var reverseKGroup = function(head, k) {
    const dummy = new ListNode(0, head);            //@init
    let groupPrev = dummy;                          //@init
    while (true) {                                  //@count
        let kth = groupPrev;                        //@count
        for (let i = 0; i < k; i++) {               // 往前数 k 个 //@count
            kth = kth.next;                         //@count
            if (!kth) {                             //@count
                return dummy.next;                  // 不够 k 个，剩下的不动 //@done
            }
        }
        const groupNext = kth.next;                 //@rev
        let prev = groupNext, cur = groupPrev.next; //@rev
        while (cur !== groupNext) {                 // 组内反转 //@rev
            [cur.next, prev, cur] = [prev, cur, cur.next];  //@rev
        }
        const first = groupPrev.next;               // 这组原来的头，现在是尾 //@rev
        groupPrev.next = kth;                       // 前面接上新的头 //@rev
        groupPrev = first;                          //@next
    }
};
