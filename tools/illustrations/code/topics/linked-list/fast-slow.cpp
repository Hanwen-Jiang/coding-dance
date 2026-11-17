class Solution {
public:
    ListNode* middleNode(ListNode* head) {
        ListNode *slow = head, *fast = head;            //@init
        while (fast && fast->next) {                    // fast 还能再走两步 //@loop
            slow = slow->next;                          // 慢指针走一步 //@step
            fast = fast->next->next;                    // 快指针走两步 //@step
        }
        return slow;                                    // fast 到头时 slow 在中间 //@done
    }
};
