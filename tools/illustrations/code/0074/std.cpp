class Solution {
public:
    bool searchMatrix(vector<vector<int>>& matrix, int target) {
        int m = matrix.size(), n = matrix[0].size();    //@init
        int lo = 0, hi = m * n - 1;                     // 当成长度 m·n 的有序数组 //@init
        while (lo <= hi) {                              //@loop
            int mid = (lo + hi) / 2;                    //@loop
            int x = matrix[mid / n][mid % n];           // 一维下标换回行列 //@loop
            if (x == target) {                          //@found
                return true;                            //@found
            }
            if (x < target) {                           //@small
                lo = mid + 1;                           //@small
            } else {                                    //@big
                hi = mid - 1;                           //@big
            }
        }
        return false;                                   //@none
    }
};
