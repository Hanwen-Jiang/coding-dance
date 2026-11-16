class Solution {
public:
    ListNode* reverseKGroup(ListNode* head, int k) {
        ListNode dummy(0, head);                    //@init
        ListNode* groupPrev = &dummy;               //@init
        while (true) {                              //@count
            ListNode* kth = groupPrev;              //@count
            for (int i = 0; i < k; i++) {           // 往前数 k 个 //@count
                kth = kth->next;                    //@count
                if (!kth) {                         //@count
                    return dummy.next;              // 不够 k 个，剩下的不动 //@done
                }
            }
            ListNode* groupNext = kth->next;        //@rev
            ListNode *prev = groupNext, *cur = groupPrev->next;     //@rev
            while (cur != groupNext) {              // 组内反转 //@rev
                ListNode* nxt = cur->next;          //@rev
                cur->next = prev;                   //@rev
                prev = cur;                         //@rev
                cur = nxt;                          //@rev
            }
            ListNode* first = groupPrev->next;      // 这组原来的头，现在是尾 //@rev
            groupPrev->next = kth;                  // 前面接上新的头 //@rev
            groupPrev = first;                      //@next
        }
    }
};
