/**
 * 力扣已经定义好了 ListNode：
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode() : val(0), next(nullptr) {}
 *     ListNode(int x) : val(x), next(nullptr) {}
 *     ListNode(int x, ListNode *next) : val(x), next(next) {}
 * };
 */
class Solution {
public:
    ListNode* buildList(vector<int>& nums) {
        ListNode dummy;                         // 哑节点：省掉「链表还是空的」这个特殊情况 //@init
        ListNode* tail = &dummy;                //@init
        for (int x : nums) {                    //@loop
            tail->next = new ListNode(x);       // 新建节点，接到尾巴后面 //@link
            tail = tail->next;                  // 尾巴往后挪 //@move
        }
        return dummy.next;                      // 真正的头是哑节点的下一个 //@done
    }
};
