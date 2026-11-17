class Solution {
public:
    ListNode* removeNthFromEnd(ListNode* head, int n) {
        ListNode dummy(0, head);                    //@init
        ListNode *slow = &dummy, *fast = &dummy;    //@init
        for (int i = 0; i < n; i++) {               // fast 先走 n 步 //@ahead
            fast = fast->next;                      //@ahead
        }
        while (fast->next) {                        // 一起走，直到 fast 在最后一个节点 //@loop
            slow = slow->next;                      //@walk
            fast = fast->next;                      //@walk
        }
        slow->next = slow->next->next;              // 跳过要删的节点 //@del
        return dummy.next;                          //@done
    }
};
