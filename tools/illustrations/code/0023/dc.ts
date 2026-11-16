function mergeKLists(lists: Array<ListNode | null>): ListNode | null {
    const merge2 = (a: ListNode | null, b: ListNode | null): ListNode | null => {  // 合并两个有序链表
        const dummy = new ListNode();               //@merge
        let cur = dummy;                            //@merge
        while (a && b) {                            //@merge
            if (a.val <= b.val) {                   //@merge
                cur.next = a;                       //@merge
                a = a.next;                         //@merge
            } else {                                //@merge
                cur.next = b;                       //@merge
                b = b.next;                         //@merge
            }
            cur = cur.next;                         //@merge
        }
        cur.next = a || b;                          //@merge,single
        return dummy.next;                          //@merge,single
    };

    if (!lists.length) {                            //@empty
        return null;                                //@empty
    }
    let n = lists.length;
    while (n > 1) {                                 // 每一轮个数减半 //@round
        let m = 0;
        for (let i = 0; i < n; i += 2) {            // 相邻两个合并，结果放回前面 //@merge,single
            lists[m++] = merge2(lists[i], i + 1 < n ? lists[i + 1] : null);    //@merge,single
        }
        n = m;                                      //@round
    }
    return lists[0];                                //@done
}
