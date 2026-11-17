class Solution {
public:
    vector<int> topKFrequent(vector<int>& nums, int k) {
        vector<vector<int>> buckets(nums.size() + 1);               //@count
        unordered_map<int, int> cnt;                                //@count
        for (int x : nums) cnt[x]++;                                //@count
        for (auto& [x, c] : cnt) {                                  //@put
            buckets[c].push_back(x);                                // 第 c 个桶放出现 c 次的数 //@put
        }
        vector<int> res;                                            //@scan
        for (int c = nums.size(); c > 0; c--) {                     //@scan
            for (int x : buckets[c]) {                              //@take
                res.push_back(x);                                   //@take
                if ((int)res.size() == k) {                         //@take
                    return res;                                     //@done
                }
            }
        }
        return res;
    }
};
