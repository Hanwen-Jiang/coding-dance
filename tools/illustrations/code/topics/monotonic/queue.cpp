class Solution {
public:
    vector<int> minSlidingWindow(vector<int>& nums, int k) {
        deque<int> q;                                   // 存下标，对应的值从队头到队尾递增 //@init
        vector<int> res;                                //@init
        for (int i = 0; i < (int)nums.size(); i++) {    //@loop
            while (!q.empty() && nums[q.back()] >= nums[i]) {   // 比 nums[i] 大的以后不可能是最小值了 //@pop
                q.pop_back();                           //@pop
            }
            q.push_back(i);                             //@push
            if (q.front() <= i - k) {                   // 队头滑出了窗口 //@expire
                q.pop_front();                          //@expire
            }
            if (i >= k - 1) {                           // 窗口满了：队头就是最小值 //@record
                res.push_back(nums[q.front()]);         //@record
            }
        }
        return res;                                     //@done
    }
};
