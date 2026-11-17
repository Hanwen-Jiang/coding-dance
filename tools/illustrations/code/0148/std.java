class Solution {
    public ListNode sortList(ListNode head) {
        if (head == null || head.next == null) {    //@base
            return head;                            //@base
        }
        ListNode slow = head, fast = head.next;     // fast 先走一步，slow 停在前半段末尾 //@mid
        while (fast != null && fast.next != null) { //@mid
            slow = slow.next;                       //@mid
            fast = fast.next.next;                  //@mid
        }
        ListNode mid = slow.next;                   // 从中间断开 //@cut
        slow.next = null;                           //@cut
        ListNode left = sortList(head), right = sortList(mid);  //@rec
        ListNode dummy = new ListNode(), cur = dummy;   //@merge
        while (left != null && right != null) {     // 合并两个有序链表 //@merge
            if (left.val <= right.val) {            //@merge
                cur.next = left;                    //@merge
                left = left.next;                   //@merge
            } else {
                cur.next = right;                   //@merge
                right = right.next;                 //@merge
            }
            cur = cur.next;                         //@merge
        }
        cur.next = left != null ? left : right;     //@merge
        return dummy.next;                          //@merge,done
    }
}
