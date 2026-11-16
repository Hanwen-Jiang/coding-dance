class Solution {
public:
    int trap(vector<int>& height) {
        int n = height.size();
        vector<int> left(n), right(n);
        for (int i = 0; i < n; i++) {               // 从左往右：到这里为止最高的柱子 //@left
            left[i] = max(i > 0 ? left[i - 1] : 0, height[i]);      //@left
        }
        for (int i = n - 1; i >= 0; i--) {          // 从右往左：它右边（含自己）最高的柱子 //@right
            right[i] = max(i < n - 1 ? right[i + 1] : 0, height[i]);    //@right
        }
        int water = 0;
        for (int i = 0; i < n; i++) {               //@each
            water += min(left[i], right[i]) - height[i];    // 水位是两边最高里较矮的那个 //@each
        }
        return water;                               //@done
    }
};
