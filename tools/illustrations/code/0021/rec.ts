function mergeTwoLists(list1: ListNode | null, list2: ListNode | null): ListNode | null {
    if (!list1 || !list2) {                     //@base
        return list1 || list2;                  //@base
    }
    if (list1.val > list2.val) {                // 让 list1 指向较小的头 //@pick
        [list1, list2] = [list2, list1];        //@pick
    }
    list1.next = mergeTwoLists(list1.next, list2);  //@pick,back
    return list1;                               //@back
}
