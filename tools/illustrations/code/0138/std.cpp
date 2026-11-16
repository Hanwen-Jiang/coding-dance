class Solution {
public:
    Node* copyRandomList(Node* head) {
        if (!head) {
            return nullptr;
        }
        unordered_map<Node*, Node*> m{{nullptr, nullptr}};  // 旧节点 -> 新节点，空对应空 //@init
        Node* cur = head;                               //@init
        while (cur) {                                   // 第一遍：只造节点 //@make
            m[cur] = new Node(cur->val);                //@make
            cur = cur->next;                            //@make
        }
        cur = head;                                     //@link
        while (cur) {                                   // 第二遍：连指针 //@link
            m[cur]->next = m[cur->next];                //@link
            m[cur]->random = m[cur->random];            //@link
            cur = cur->next;                            //@link
        }
        return m[head];                                 //@done
    }
};
