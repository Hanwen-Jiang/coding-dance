var copyRandomList = function(head) {
    if (!head) {
        return null;
    }
    const m = new Map();                            // 旧节点 -> 新节点 //@init
    let cur = head;                                 //@init
    while (cur) {                                   // 第一遍：只造节点 //@make
        m.set(cur, new _Node(cur.val, null, null)); //@make
        cur = cur.next;                             //@make
    }
    cur = head;                                     //@link
    while (cur) {                                   // 第二遍：连指针 //@link
        m.get(cur).next = cur.next ? m.get(cur.next) : null;        //@link
        m.get(cur).random = cur.random ? m.get(cur.random) : null;  //@link
        cur = cur.next;                             //@link
    }
    return m.get(head);                             //@done
};
