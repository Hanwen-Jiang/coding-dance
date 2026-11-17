class Solution {
public:
    ListNode* mergeKLists(vector<ListNode*>& lists) {
        // 小顶堆：值大的往下沉，堆顶是值最小的节点
        auto cmp = [](ListNode* a, ListNode* b) { return a->val > b->val; };
        priority_queue<ListNode*, vector<ListNode*>, decltype(cmp)> heap(cmp);  //@build
        for (ListNode* node : lists) {                  //@build
            if (node) {                                 //@build
                heap.push(node);                        //@build
            }
        }
        ListNode dummy, *cur = &dummy;                  //@build
        while (!heap.empty()) {
            ListNode* node = heap.top();                //@pop
            heap.pop();                                 //@pop
            cur->next = node;                           //@pop
            cur = node;                                 //@pop
            if (node->next) {                           //@push,end
                heap.push(node->next);                  //@push
            }
        }
        return dummy.next;                              //@done
    }
};
