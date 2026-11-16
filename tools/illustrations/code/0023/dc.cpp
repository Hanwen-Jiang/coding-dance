class Solution {
public:
    ListNode* mergeKLists(vector<ListNode*>& lists) {
        if (lists.empty()) {                            //@empty
            return nullptr;                             //@empty
        }
        int n = lists.size();
        while (n > 1) {                                 // 每一轮个数减半 //@round
            int m = 0;
            for (int i = 0; i < n; i += 2) {            // 相邻两个合并，结果放回前面 //@merge,single
                lists[m++] = merge2(lists[i], i + 1 < n ? lists[i + 1] : nullptr);    //@merge,single
            }
            n = m;                                      //@round
        }
        return lists[0];                                //@done
    }

private:
    ListNode* merge2(ListNode* a, ListNode* b) {        // 合并两个有序链表
        ListNode dummy, *cur = &dummy;                  //@merge
        while (a && b) {                                //@merge
            if (a->val <= b->val) {                     //@merge
                cur->next = a;                          //@merge
                a = a->next;                            //@merge
            } else {                                    //@merge
                cur->next = b;                          //@merge
                b = b->next;                            //@merge
            }
            cur = cur->next;                            //@merge
        }
        cur->next = a ? a : b;                          //@merge,single
        return dummy.next;                              //@merge,single
    }
};
