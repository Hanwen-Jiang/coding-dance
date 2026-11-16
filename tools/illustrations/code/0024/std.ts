function swapPairs(head: ListNode | null): ListNode | null {
    const dummy = new ListNode(0, head);                    //@init
    let prev = dummy;                                       //@init
    while (prev.next && prev.next.next) {                   //@pair
        const a: ListNode = prev.next, b: ListNode = prev.next.next;    //@pair
        prev.next = b;                                      // 三根指针：prev → b → a → 后面 //@swap
        a.next = b.next;                                    //@swap
        b.next = a;                                         //@swap
        prev = a;                                           // a 现在在后面，是下一对的前驱 //@next
    }
    return dummy.next;                                      //@done
}
