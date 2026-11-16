class Solution {
    private int n;

    public ListNode removeNthFromEnd(ListNode head, int n) {
        this.n = n;
        ListNode dummy = new ListNode(0, head);     //@start
        rec(dummy);                                 //@start
        return dummy.next;                          //@done
    }

    // 返回 node 是倒数第几个
    private int rec(ListNode node) {
        if (node == null) {                         //@base
            return 0;                               //@base
        }
        int k = rec(node.next) + 1;                 //@down,count
        if (k == n + 1) {                           //@del
            node.next = node.next.next;             //@del
        }
        return k;                                   //@ret
    }
}
