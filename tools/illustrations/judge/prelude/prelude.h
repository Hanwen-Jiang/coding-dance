#include <bits/stdc++.h>
using namespace std;

// 力扣 C++ 环境里现成的两个节点类型
struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
};

// 层序数组里表示空位的值
const int JNUL = INT_MIN;

// 本用例建出的节点：要按「是不是同一个节点」判的题用（见 judge/util.js 里的类型说明）
inline vector<ListNode*> jNodes;
inline TreeNode* jLastTree = nullptr;
inline void jReset() { jNodes.clear(); jLastTree = nullptr; }

inline ListNode* jList(const vector<int>& v) {
    ListNode dummy, *cur = &dummy;
    for (int x : v) { cur->next = new ListNode(x); cur = cur->next; jNodes.push_back(cur); }
    return dummy.next;
}

// 最后一个节点接回下标 pos 的节点（-1 不成环）
inline ListNode* jCycle(const vector<int>& v, int pos) {
    size_t s = jNodes.size();
    ListNode* head = jList(v);
    if (pos >= 0 && !v.empty()) jNodes[s + v.size() - 1]->next = jNodes[s + pos];
    return head;
}

// 独有部分后面接上本用例建出的第 k 个节点（-1 不接）
inline ListNode* jJoinList(const vector<int>& v, int k) {
    ListNode* tail = k >= 0 ? jNodes[k] : nullptr;
    size_t s = jNodes.size();
    ListNode* head = jList(v);
    if (v.empty()) return tail;
    jNodes[s + v.size() - 1]->next = tail;
    return head;
}

inline TreeNode* jTreeOf(const vector<int>& v);
inline TreeNode* jTree(const vector<int>& v) { return jLastTree = jTreeOf(v); }

inline TreeNode* jFind(int val) {
    vector<TreeNode*> st{jLastTree};
    while (!st.empty()) {
        TreeNode* t = st.back(); st.pop_back();
        if (!t) continue;
        if (t->val == val) return t;
        st.push_back(t->left); st.push_back(t->right);
    }
    return nullptr;
}

inline TreeNode* jTreeOf(const vector<int>& v) {
    if (v.empty() || v[0] == JNUL) return nullptr;
    TreeNode* root = new TreeNode(v[0]);
    vector<TreeNode*> q{root};
    size_t i = 1;
    for (size_t h = 0; i < v.size() && h < q.size(); h++) {
        TreeNode* node = q[h];
        if (v[i] != JNUL) { node->left = new TreeNode(v[i]); q.push_back(node->left); }
        i++;
        if (i < v.size()) {
            if (v[i] != JNUL) { node->right = new TreeNode(v[i]); q.push_back(node->right); }
            i++;
        }
    }
    return root;
}

inline string js(bool v) { return v ? "true" : "false"; }
inline string js(int v) { return to_string(v); }
inline string js(long v) { return to_string(v); }
inline string js(long long v) { return to_string(v); }
inline string js(double v) { ostringstream o; o << setprecision(12) << v; return o.str(); }
inline string js(const string& s) {
    string o = "\"";
    for (char c : s) {
        if (c == '"' || c == '\\') { o += '\\'; o += c; }
        else if (c == '\n') o += "\\n";
        else if (c == '\t') o += "\\t";
        else o += c;
    }
    return o + "\"";
}
inline string js(const char* s) { return js(string(s)); }
inline string js(char c) { return js(string(1, c)); }
inline string js(ListNode* h) {
    string o = "[";
    for (int n = 0; h && n < 100000; h = h->next, n++) { if (n) o += ","; o += to_string(h->val); }
    return o + "]";
}
inline string js(TreeNode* root) {
    vector<TreeNode*> q{root};
    vector<string> out;
    for (size_t h = 0; h < q.size(); h++) {
        TreeNode* t = q[h];
        if (!t) { out.push_back("null"); continue; }
        out.push_back(to_string(t->val)); q.push_back(t->left); q.push_back(t->right);
    }
    while (!out.empty() && out.back() == "null") out.pop_back();
    string o = "[";
    for (size_t i = 0; i < out.size(); i++) { if (i) o += ","; o += out[i]; }
    return o + "]";
}
template <class T> string js(const vector<T>& v) {
    string o = "[";
    for (size_t i = 0; i < v.size(); i++) { if (i) o += ","; o += js(v[i]); }
    return o + "]";
}
inline string jIndex(ListNode* n) {
    if (!n) return "null";
    for (size_t i = 0; i < jNodes.size(); i++) if (jNodes[i] == n) return to_string(i);
    return js(string("不是输入里的节点"));
}
inline string jVal(TreeNode* n) { return n ? to_string(n->val) : "null"; }
inline string jJoin(const vector<string>& parts) {
    string o = "[";
    for (size_t i = 0; i < parts.size(); i++) { if (i) o += ","; o += parts[i]; }
    return o + "]";
}
