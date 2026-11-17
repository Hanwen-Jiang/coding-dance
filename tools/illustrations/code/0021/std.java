class Solution {
    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {
        ListNode dummy = new ListNode(), cur = dummy;   //@init
        while (list1 != null && list2 != null) {
            if (list1.val <= list2.val) {               //@take1,take2
                cur.next = list1;                       //@take1
                list1 = list1.next;                     //@take1
            } else {                                    //@take2
                cur.next = list2;                       //@take2
                list2 = list2.next;                     //@take2
            }
            cur = cur.next;                             //@take1,take2
        }
        cur.next = list1 != null ? list1 : list2;       // 剩下的整段接上 //@rest
        return dummy.next;                              //@done
    }
}
