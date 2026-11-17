class KthLargest {
    int k;
    priority_queue<int, vector<int>, greater<int>> heap;   // 最小堆，只留最大的 k 个数 //@init

public:
    KthLargest(int k, const vector<int>& nums) : k(k) {
        for (int x : nums) {                    //@init
            add(x);                             //@init
        }
    }

    int add(int val) {
        heap.push(val);                         //@push
        if ((int)heap.size() > k) {             // 多了一个：最小的那个不可能是前 k 大 //@trim
            heap.pop();                         //@trim
        }
        return heap.top();                      // 堆顶就是第 k 大 //@top
    }
};
