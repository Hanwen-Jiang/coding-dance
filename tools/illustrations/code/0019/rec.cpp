class Solution {
public:
    ListNode* removeNthFromEnd(ListNode* head, int n) {
        // 返回 node 是倒数第几个
        function<int(ListNode*)> rec = [&](ListNode* node) {
            if (!node) {                            //@base
                return 0;                           //@base
            }
            int k = rec(node->next) + 1;            //@down,count
            if (k == n + 1) {                       //@del
                node->next = node->next->next;      //@del
            }
            return k;                               //@ret
        };
        ListNode dummy(0, head);                    //@start
        rec(&dummy);                                //@start
        return dummy.next;                          //@done
    }
};
