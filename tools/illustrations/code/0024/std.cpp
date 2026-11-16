class Solution {
public:
    ListNode* swapPairs(ListNode* head) {
        ListNode dummy(0, head);                                //@init
        ListNode* prev = &dummy;                                //@init
        while (prev->next && prev->next->next) {                //@pair
            ListNode *a = prev->next, *b = prev->next->next;    //@pair
            prev->next = b;                                     // 三根指针：prev → b → a → 后面 //@swap
            a->next = b->next;                                  //@swap
            b->next = a;                                        //@swap
            prev = a;                                           // a 现在在后面，是下一对的前驱 //@next
        }
        return dummy.next;                                      //@done
    }
};
