public class Solution {
    public ListNode detectCycle(ListNode head) {
        Set<ListNode> seen = new HashSet<>();           //@init
        while (head != null && !seen.contains(head)) {  //@add,found,none
            seen.add(head);                             //@add
            head = head.next;                           //@add
        }
        return head;                                    //@found,none
    }
}
