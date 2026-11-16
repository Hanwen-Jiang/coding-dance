var mergeKLists = function(lists) {
    const heap = [];                                // 小顶堆，按节点的值比较
    const up = (i) => {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (heap[p].val <= heap[i].val) break;
            [heap[p], heap[i]] = [heap[i], heap[p]];
            i = p;
        }
    };
    const down = (i) => {
        while (true) {
            const l = 2 * i + 1, r = l + 1;
            let s = i;
            if (l < heap.length && heap[l].val < heap[s].val) s = l;
            if (r < heap.length && heap[r].val < heap[s].val) s = r;
            if (s === i) break;
            [heap[s], heap[i]] = [heap[i], heap[s]];
            i = s;
        }
    };
    for (const node of lists) {                     //@build
        if (node) {                                 //@build
            heap.push(node);                        //@build
            up(heap.length - 1);                    //@build
        }
    }
    const dummy = new ListNode();                   //@build
    let cur = dummy;                                //@build
    while (heap.length) {
        const node = heap[0], last = heap.pop();    // 弹出堆顶 //@pop
        if (heap.length) {                          //@pop
            heap[0] = last;                         //@pop
            down(0);                                //@pop
        }
        cur.next = node;                            //@pop
        cur = node;                                 //@pop
        if (node.next) {                            //@push,end
            heap.push(node.next);                   //@push
            up(heap.length - 1);                    //@push
        }
    }
    return dummy.next;                              //@done
};
