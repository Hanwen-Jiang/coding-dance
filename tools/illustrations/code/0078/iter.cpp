class Solution {
public:
    vector<vector<int>> subsets(vector<int>& nums) {
        vector<vector<int>> res = {{}};                     //@init
        for (int x : nums) {
            int size = res.size();                          // 只复制已有的子集 //@add
            for (int k = 0; k < size; k++) {                //@add
                vector<int> s = res[k];                     //@add
                s.push_back(x);                             //@add
                res.push_back(s);                           //@add
            }
        }
        return res;                                         //@done
    }
};
