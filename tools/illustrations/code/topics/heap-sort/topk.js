// JavaScript 没有内置的堆，这里手写一个最小堆（力扣的 JavaScript 环境里可以直接用 MinPriorityQueue）
class MinHeap {
    constructor() {
        this.a = [];
    }
    size() {
        return this.a.length;
    }
    peek() {
        return this.a[0];
    }
    push(x) {
        const a = this.a;
        a.push(x);
        for (let i = a.length - 1; i > 0 && a[(i - 1) >> 1] > a[i]; i = (i - 1) >> 1) {
            [a[i], a[(i - 1) >> 1]] = [a[(i - 1) >> 1], a[i]];
        }
    }
    pop() {
        const a = this.a, top = a[0], last = a.pop();
        if (a.length) {
            a[0] = last;
            for (let i = 0; ;) {
                let small = i;
                for (const c of [2 * i + 1, 2 * i + 2]) {
                    if (c < a.length && a[c] < a[small]) small = c;
                }
                if (small === i) break;
                [a[i], a[small]] = [a[small], a[i]];
                i = small;
            }
        }
        return top;
    }
}

class KthLargest {
    constructor(k, nums) {
        this.k = k;
        this.heap = new MinHeap();              // 最小堆，只留最大的 k 个数 //@init
        for (const x of nums) {                 //@init
            this.add(x);                        //@init
        }
    }

    add(val) {
        this.heap.push(val);                    //@push
        if (this.heap.size() > this.k) {        // 多了一个：最小的那个不可能是前 k 大 //@trim
            this.heap.pop();                    //@trim
        }
        return this.heap.peek();                // 堆顶就是第 k 大 //@top
    }
}
