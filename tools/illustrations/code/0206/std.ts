function reverseList(head: ListNode | null): ListNode | null {
    let prev: ListNode | null = null, cur = head;   //@init
    while (cur) {
        const nxt = cur.next;       // 先记住下一个 //@save
        cur.next = prev;            // 箭头掉头 //@flip
        prev = cur;                 //@mprev
        cur = nxt;                  //@mcur
    }
    return prev;                    //@done
}
