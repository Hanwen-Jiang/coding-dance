class Solution {
public:
    int findKthLargest(vector<int>& nums, int k) {
        priority_queue<int, vector<int>, greater<int>> heap(nums.begin(), nums.begin() + k);   // 先放前 k 个，建小顶堆 //@push
        for (int i = k; i < (int)nums.size(); i++) {
            if (nums[i] > heap.top()) {                 // 比堆顶大，才有资格进前 k //@replace,skip
                heap.pop();                             //@replace
                heap.push(nums[i]);                     //@replace
            }
        }
        return heap.top();                              //@done
    }
};
