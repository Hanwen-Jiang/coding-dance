class Solution {
public:
    int evalRPN(vector<string>& tokens) {
        stack<long long> st;                            //@init
        for (auto& t : tokens) {                        //@loop
            if (t.size() > 1 || isdigit(t[0])) {        // 长度大于 1 的一定是数字，比如 "-11" //@push
                st.push(stoll(t));                      // 数字直接压栈 //@push
                continue;                               //@push
            }
            long long b = st.top(); st.pop();           // 先弹出的是右边的数 //@pop
            long long a = st.top(); st.pop();           //@pop
            if (t == "+") {                             //@calc
                st.push(a + b);                         //@calc
            } else if (t == "-") {                      //@calc
                st.push(a - b);                         //@calc
            } else if (t == "*") {                      //@calc
                st.push(a * b);                         //@calc
            } else {                                    //@calc
                st.push(a / b);                         // 整数除法本来就向零取整 //@calc
            }
        }
        return (int)st.top();                           //@done
    }
};
