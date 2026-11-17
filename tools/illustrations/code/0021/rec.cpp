class Solution {
public:
    ListNode* mergeTwoLists(ListNode* list1, ListNode* list2) {
        if (!list1 || !list2) {                         //@base
            return list1 ? list1 : list2;               //@base
        }
        if (list1->val > list2->val) {                  // 让 list1 指向较小的头 //@pick
            swap(list1, list2);                         //@pick
        }
        list1->next = mergeTwoLists(list1->next, list2);    //@pick,back
        return list1;                                   //@back
    }
};
