class MedianFinder {
public:
    MedianFinder() {
        lo = {};                                        // 大顶堆，较小的一半 //@init
        hi = {};                                        // 小顶堆，较大的一半 //@init
    }

    void addNum(int num) {
        lo.push(num);                                   //@add
        hi.push(lo.top()); lo.pop();                    // lo 的最大值挪到 hi //@add
        if (hi.size() > lo.size()) {                    // 保持 lo 不比 hi 少 //@add,rebal
            lo.push(hi.top()); hi.pop();                //@rebal
        }
    }

    double findMedian() {
        if (lo.size() > hi.size()) {                    //@odd,even
            return lo.top();                            //@odd
        }
        return (lo.top() + (double)hi.top()) / 2;       //@even
    }

private:
    priority_queue<int> lo;
    priority_queue<int, vector<int>, greater<int>> hi;
};
