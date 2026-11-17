class Solution {
public:
    vector<int> topKFrequent(vector<int>& nums, int k) {
        unordered_map<int, int> cnt;                                //@count
        for (int x : nums) cnt[x]++;                                //@count
        // 小顶堆，只留次数最多的 k 个；元素是 (次数, 数)
        priority_queue<pair<int, int>, vector<pair<int, int>>, greater<>> heap;    //@count
        for (auto& [x, c] : cnt) {
            heap.push({c, x});                                      //@push,pop
            if ((int)heap.size() > k) {                             //@push,pop
                heap.pop();                                         // 挤掉次数最少的 //@pop
            }
        }
        vector<int> res;                                            //@done
        for (; !heap.empty(); heap.pop()) res.push_back(heap.top().second);   //@done
        return res;                                                 //@done
    }
};
