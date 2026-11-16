class Solution {
    public boolean isPalindrome(ListNode head) {
        ListNode slow = head, fast = head;          //@init
        while (fast != null && fast.next != null) { // 找中点 //@mid
            slow = slow.next;                       //@mid
            fast = fast.next.next;                  //@mid
        }
        ListNode prev = null;                       //@rev
        while (slow != null) {                      // 反转后半段 //@rev
            ListNode nxt = slow.next;               //@rev
            slow.next = prev;                       //@rev
            prev = slow;                            //@rev
            slow = nxt;                             //@rev
        }
        ListNode left = head, right = prev;         //@cmp
        while (right != null) {                     // 两头往中间比 //@cmp
            if (left.val != right.val) {            //@cmp,bad
                return false;                       //@bad
            }
            left = left.next;                       //@cmp
            right = right.next;                     //@cmp
        }
        return true;                                //@done
    }
}
