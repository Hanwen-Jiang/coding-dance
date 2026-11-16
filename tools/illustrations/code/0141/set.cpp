class Solution {
public:
    bool hasCycle(ListNode *head) {
        unordered_set<ListNode*> seen;                  //@init
        while (head && !seen.count(head)) {             //@add,found,none
            seen.insert(head);                          //@add
            head = head->next;                          //@add
        }
        return head != nullptr;                         //@found,none
    }
};
