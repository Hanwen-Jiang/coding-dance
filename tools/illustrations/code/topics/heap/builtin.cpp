class Solution {
public:
    int lastStoneWeight(vector<int>& stones) {
        priority_queue<int> heap(stones.begin(), stones.end());    // 默认就是最大堆，O(n) 建堆 //@init
        while (heap.size() > 1) {                   //@loop
            int y = heap.top(); heap.pop();         // 最重的 //@pop
            int x = heap.top(); heap.pop();         // 第二重的 //@pop
            if (x != y) {                           //@push
                heap.push(y - x);                   // 碎了还剩 y - x //@push
            }
        }
        return heap.empty() ? 0 : heap.top();       //@done
    }
};
