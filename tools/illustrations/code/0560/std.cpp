class Solution {
public:
    int subarraySum(vector<int>& nums, int k) {
        unordered_map<int, int> count;                  //@init
        count[0] = 1;                                   // 空前缀 //@init
        int pre = 0, res = 0;                           //@init
        for (int x : nums) {                            //@query
            pre += x;                                   //@query
            auto it = count.find(pre - k);              // 先查 //@query
            if (it != count.end()) res += it->second;   //@query
            count[pre]++;                               // 再存 //@store
        }
        return res;                                     //@done
    }
};
