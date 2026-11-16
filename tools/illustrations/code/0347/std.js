var topKFrequent = function(nums, k) {
    const cnt = new Map();                                      //@count
    for (const x of nums) cnt.set(x, (cnt.get(x) || 0) + 1);    //@count
    const heap = [];                                            // 小顶堆，只留次数最多的 k 个；元素是 [次数, 数] //@count
    const up = (i) => {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (heap[p][0] <= heap[i][0]) break;
            [heap[p], heap[i]] = [heap[i], heap[p]];
            i = p;
        }
    };
    const down = (i) => {
        while (true) {
            const l = 2 * i + 1, r = l + 1;
            let s = i;
            if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
            if (r < heap.length && heap[r][0] < heap[s][0]) s = r;
            if (s === i) break;
            [heap[s], heap[i]] = [heap[i], heap[s]];
            i = s;
        }
    };
    for (const [x, c] of cnt) {
        heap.push([c, x]);                                      //@push,pop
        up(heap.length - 1);                                    //@push,pop
        if (heap.length > k) {                                  //@push,pop
            heap[0] = heap.pop();                               // 挤掉次数最少的：用最后一个顶替堆顶 //@pop
            down(0);                                            //@pop
        }
    }
    return heap.map(([, x]) => x);                              //@done
};
