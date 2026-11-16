class Solution {
    public Node copyRandomList(Node head) {
        if (head == null) {
            return null;
        }
        Map<Node, Node> m = new HashMap<>();            // 旧节点 -> 新节点 //@init
        Node cur = head;                                //@init
        while (cur != null) {                           // 第一遍：只造节点 //@make
            m.put(cur, new Node(cur.val));              //@make
            cur = cur.next;                             //@make
        }
        cur = head;                                     //@link
        while (cur != null) {                           // 第二遍：连指针 //@link
            m.get(cur).next = m.get(cur.next);          // 指向空时 get(null) 也是 null //@link
            m.get(cur).random = m.get(cur.random);      //@link
            cur = cur.next;                             //@link
        }
        return m.get(head);                             //@done
    }
}
