class Solution {
    public ListNode reverseList(ListNode head) {
        if (head == null || head.next == null) {    //@base
            return head;                            //@base
        }
        ListNode newHead = reverseList(head.next);  //@down
        head.next.next = head;                      // 让后一个节点指回自己 //@back
        head.next = null;                           //@cut
        return newHead;                             //@ret
    }
}
