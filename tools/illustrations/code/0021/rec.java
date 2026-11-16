class Solution {
    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {
        if (list1 == null || list2 == null) {           //@base
            return list1 != null ? list1 : list2;       //@base
        }
        if (list1.val > list2.val) {                    // 让 list1 指向较小的头 //@pick
            ListNode t = list1;                         //@pick
            list1 = list2;                              //@pick
            list2 = t;                                  //@pick
        }
        list1.next = mergeTwoLists(list1.next, list2);  //@pick,back
        return list1;                                   //@back
    }
}
