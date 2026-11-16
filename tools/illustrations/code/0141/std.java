public class Solution {
    public boolean hasCycle(ListNode head) {
        ListNode slow = head, fast = head;              //@init
        while (fast != null && fast.next != null) {     //@step
            slow = slow.next;                           //@step
            fast = fast.next.next;                      //@step
            if (slow == fast) {                         //@step,meet
                return true;                            //@meet
            }
        }
        return false;                                   //@none
    }
}
