class Solution {
public:
    ListNode* swapPairs(ListNode* head) {
        if (!head || !head->next) {                 //@base
            return head;                            //@base
        }
        ListNode* nxt = head->next;                 //@call
        head->next = swapPairs(nxt->next);          //@call,swap
        nxt->next = head;                           //@swap
        return nxt;                                 //@swap,done
    }
};
