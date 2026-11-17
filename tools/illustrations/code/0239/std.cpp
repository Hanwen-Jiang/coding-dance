class Solution {
public:
    vector<int> maxSlidingWindow(vector<int>& nums, int k) {
        deque<int> q;                                   // q 存下标，对应的值递减 //@init
        vector<int> res;                                //@init
        for (int i = 0; i < (int)nums.size(); i++) {
            while (!q.empty() && nums[q.back()] <= nums[i]) {  //@push
                q.pop_back();                           // 队尾比新数小，没用了 //@push
            }
            q.push_back(i);                             //@push
            if (q.front() <= i - k) {                   //@expire
                q.pop_front();                          // 队头滑出窗口 //@expire
            }
            if (i >= k - 1) {                           //@record
                res.push_back(nums[q.front()]);         //@record
            }
        }
        return res;                                     //@done
    }
};
