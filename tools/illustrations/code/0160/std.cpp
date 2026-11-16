class Solution {
public:
    ListNode *getIntersectionNode(ListNode *headA, ListNode *headB) {
        ListNode *pa = headA, *pb = headB;              //@init
        while (pa != pb) {                              //@step
            pa = pa ? pa->next : headB;                 // 走到空就换到 B 的头 //@step
            pb = pb ? pb->next : headA;                 //@step
        }
        return pa;                                      // 交点，或者都是空 //@done
    }
};
