class MinHeap {
    vector<int> a;                                          // i 的孩子是 2i+1、2i+2 //@init

public:
    void push(int x) {
        a.push_back(x);                                     // 先放到最后 //@push
        int i = a.size() - 1;                               //@push
        while (i > 0 && a[(i - 1) / 2] > a[i]) {            // 比父节点小就往上换 //@up
            int p = (i - 1) / 2;                            //@up
            swap(a[i], a[p]);                               //@up
            i = p;                                          //@up
        }
    }

    int pop() {
        int top = a[0];                                     //@pop
        a[0] = a.back();                                    // 最后一个挪到堆顶 //@pop
        a.pop_back();                                       //@pop
        int i = 0, n = a.size();
        while (true) {
            int small = i, l = 2 * i + 1, r = 2 * i + 2;    //@down
            if (l < n && a[l] < a[small]) {                 //@down
                small = l;                                  //@down
            }
            if (r < n && a[r] < a[small]) {                 //@down
                small = r;                                  //@down
            }
            if (small == i) {                               // 两个孩子都不比它小 //@stop
                break;                                      //@stop
            }
            swap(a[i], a[small]);                           //@down
            i = small;                                      //@down
        }
        return top;                                         //@ret
    }

    int peek() {
        return a[0];                                        //@peek
    }

    int size() {
        return a.size();                                    //@size
    }
};
