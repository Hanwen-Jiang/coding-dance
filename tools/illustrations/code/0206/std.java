class Solution {
    public ListNode reverseList(ListNode head) {
        ListNode prev = null, cur = head;   //@init
        while (cur != null) {
            ListNode nxt = cur.next;        // 先记住下一个 //@save
            cur.next = prev;                // 箭头掉头 //@flip
            prev = cur;                     //@mprev
            cur = nxt;                      //@mcur
        }
        return prev;                        //@done
    }
}
