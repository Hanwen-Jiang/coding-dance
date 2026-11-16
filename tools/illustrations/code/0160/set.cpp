class Solution {
public:
    ListNode *getIntersectionNode(ListNode *headA, ListNode *headB) {
        unordered_set<ListNode*> seen;                  //@init
        while (headA) {                                 //@addA
            seen.insert(headA);                         //@addA
            headA = headA->next;                        //@addA
        }
        while (headB && !seen.count(headB)) {           //@walkB,found,none
            headB = headB->next;                        //@walkB
        }
        return headB;                                   //@found,none
    }
};
