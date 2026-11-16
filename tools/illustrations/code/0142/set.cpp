class Solution {
public:
    ListNode *detectCycle(ListNode *head) {
        unordered_set<ListNode*> seen;                  //@init
        while (head && !seen.count(head)) {             //@add,found,none
            seen.insert(head);                          //@add
            head = head->next;                          //@add
        }
        return head;                                    //@found,none
    }
};
