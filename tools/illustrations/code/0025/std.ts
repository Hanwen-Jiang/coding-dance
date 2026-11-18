function reverseKGroup(head: ListNode | null, k: number): ListNode | null {
    const dummy = new ListNode(0, head);            //@dummy
    let groupPrev: ListNode = dummy;                //@gp0
    while (true) {
        let kth: ListNode | null = groupPrev;       //@kth0
        for (let i = 0; i < k; i++) {               // 往前数 k 个
            kth = kth!.next;                        //@kstep
            if (!kth) {                             //@kchk
                return dummy.next;                  // 不够 k 个，剩下的不动 //@ret
            }
        }
        const groupNext = kth!.next;                // 下一组的开头 //@cut
        let prev = groupNext;                       // prev 从 groupNext 开始 //@prev0
        let cur = groupPrev.next!;                  //@cur0
        while (cur !== groupNext) {                 // 组内反转 //@exit
            const nxt = cur.next!;                  // 先记住下一个 //@save
            cur.next = prev;                        // 箭头掉头 //@flip
            prev = cur;                             //@mprev
            cur = nxt;                              //@mcur
        }
        const first = groupPrev.next!;              // 这组原来的头，现在是尾 //@first
        groupPrev.next = kth;                       // 前面接上新的头 //@link
        groupPrev = first;                          //@next
    }
}
