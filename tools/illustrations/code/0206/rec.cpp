class Solution {
public:
    ListNode* reverseList(ListNode* head) {
        if (!head || !head->next) {                 //@base
            return head;                            //@base
        }
        ListNode* newHead = reverseList(head->next);    //@down
        head->next->next = head;                    // 让后一个节点指回自己 //@back
        head->next = nullptr;                       //@cut
        return newHead;                             //@ret
    }
};
