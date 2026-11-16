public class Solution {
    public boolean hasCycle(ListNode head) {
        Set<ListNode> seen = new HashSet<>();           //@init
        while (head != null && !seen.contains(head)) {  //@add,found,none
            seen.add(head);                             //@add
            head = head.next;                           //@add
        }
        return head != null;                            //@found,none
    }
}
