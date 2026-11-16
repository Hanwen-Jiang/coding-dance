class Solution {
public:
    bool hasCycle(ListNode *head) {
        ListNode *slow = head, *fast = head;            //@init
        while (fast && fast->next) {                    //@step
            slow = slow->next;                          //@step
            fast = fast->next->next;                    //@step
            if (slow == fast) {                         //@step,meet
                return true;                            //@meet
            }
        }
        return false;                                   //@none
    }
};
