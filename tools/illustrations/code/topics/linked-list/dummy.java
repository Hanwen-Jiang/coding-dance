class Solution {
    public ListNode removeElements(ListNode head, int val) {
        ListNode dummy = new ListNode(0, head);     // 头节点前面也有一个节点了 //@init
        ListNode cur = dummy;                       //@init
        while (cur.next != null) {                  // 检查的是 cur 的下一个节点 //@check
            if (cur.next.val == val) {              //@check
                cur.next = cur.next.next;           // 跳过它，就把它删掉了 //@del
            } else {                                //@keep
                cur = cur.next;                     //@keep
            }
        }
        return dummy.next;                          //@done
    }
}
