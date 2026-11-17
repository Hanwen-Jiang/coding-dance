class Solution {
public:
    vector<vector<int>> merge(vector<vector<int>>& intervals) {
        sort(intervals.begin(), intervals.end());           // 默认先按起点排 //@sort
        vector<vector<int>> res;                            //@sort
        for (auto& cur : intervals) {
            int a = cur[0], b = cur[1];
            if (!res.empty() && a <= res.back()[1]) {       //@merge
                res.back()[1] = max(res.back()[1], b);      // 重叠，延长终点 //@merge
            } else {
                res.push_back({a, b});                      // 不重叠，另起一段 //@new
            }
        }
        return res;                                         //@done
    }
};
