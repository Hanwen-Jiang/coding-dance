class Solution {
public:
    ListNode *detectCycle(ListNode *head) {
        ListNode *slow = head, *fast = head;            //@init
        while (fast && fast->next) {                    //@step
            slow = slow->next;                          //@step
            fast = fast->next->next;                    //@step
            if (slow == fast) {                         // 相遇，有环 //@step,meet
                ListNode* p = head;                     //@meet
                while (p != slow) {                     // 两边各走一步，在入口相遇 //@walk,entry
                    p = p->next;                        //@walk
                    slow = slow->next;                  //@walk
                }
                return p;                               //@entry
            }
        }
        return nullptr;                                 //@none
    }
};
