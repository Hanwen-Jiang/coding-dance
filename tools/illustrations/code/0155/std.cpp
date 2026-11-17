class MinStack {
    vector<int> st;                             //@init
    vector<int> mins;                           // mins.back() 是当前栈里的最小值 //@init

public:
    MinStack() {}

    void push(int val) {
        st.push_back(val);                      //@push
        mins.push_back(mins.empty() ? val : min(val, mins.back()));    //@push
    }

    void pop() {
        st.pop_back();                          //@pop
        mins.pop_back();                        // 和主栈同步弹出 //@pop
    }

    int top() {
        return st.back();                       //@top
    }

    int getMin() {
        return mins.back();                     //@getMin
    }
};
