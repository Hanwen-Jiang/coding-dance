class Solution {
public:
    vector<int> intersection(vector<int>& nums1, vector<int>& nums2) {
        unordered_set<int> seen(nums1.begin(), nums1.end());    // 查一个数在不在：O(1) //@init
        unordered_set<int> res;                                 // 答案也用集合，自动去重 //@init
        for (int x : nums2) {                                   //@loop
            if (seen.count(x)) {                                //@hit
                res.insert(x);                                  //@hit
            }
        }
        return vector<int>(res.begin(), res.end());             //@done
    }
};
