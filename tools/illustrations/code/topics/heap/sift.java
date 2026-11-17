class MinHeap {
    private final List<Integer> a = new ArrayList<>();      // i 的孩子是 2i+1、2i+2 //@init

    public void push(int x) {
        a.add(x);                                           // 先放到最后 //@push
        int i = a.size() - 1;                               //@push
        while (i > 0 && a.get((i - 1) / 2) > a.get(i)) {    // 比父节点小就往上换 //@up
            int p = (i - 1) / 2;                            //@up
            swap(i, p);                                     //@up
            i = p;                                          //@up
        }
    }

    public int pop() {
        int top = a.get(0);                                 //@pop
        int last = a.remove(a.size() - 1);                  //@pop
        if (a.isEmpty()) {                                  //@pop
            return top;                                     //@pop
        }
        a.set(0, last);                                     // 最后一个挪到堆顶 //@pop
        int i = 0, n = a.size();
        while (true) {
            int small = i, l = 2 * i + 1, r = 2 * i + 2;    //@down
            if (l < n && a.get(l) < a.get(small)) {         //@down
                small = l;                                  //@down
            }
            if (r < n && a.get(r) < a.get(small)) {         //@down
                small = r;                                  //@down
            }
            if (small == i) {                               // 两个孩子都不比它小 //@stop
                break;                                      //@stop
            }
            swap(i, small);                                 //@down
            i = small;                                      //@down
        }
        return top;                                         //@ret
    }

    public int peek() {
        return a.get(0);                                    //@peek
    }

    public int size() {
        return a.size();                                    //@size
    }

    private void swap(int i, int j) {
        int t = a.get(i);
        a.set(i, a.get(j));
        a.set(j, t);
    }
}
