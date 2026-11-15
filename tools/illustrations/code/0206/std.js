var reverseList = function(head) {
    let prev = null, cur = head;    //@init
    while (cur) {
        const nxt = cur.next;       // 先记住下一个 //@flip
        cur.next = prev;            // 箭头掉头 //@flip
        prev = cur;                 // 两个指针都往前走 //@move
        cur = nxt;                  //@move
    }
    return prev;                    //@done
};
