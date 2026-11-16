public class Solution {
    public ListNode getIntersectionNode(ListNode headA, ListNode headB) {
        Set<ListNode> seen = new HashSet<>();           //@init
        while (headA != null) {                         //@addA
            seen.add(headA);                            //@addA
            headA = headA.next;                         //@addA
        }
        while (headB != null && !seen.contains(headB)) {    //@walkB,found,none
            headB = headB.next;                         //@walkB
        }
        return headB;                                   //@found,none
    }
}
