// TypeScript 没有内置的堆，这里手写一个最小堆（力扣的 TypeScript 环境里可以直接用 MinPriorityQueue）
class MinHeap {
    private a: number[] = [];
    size(): number {
        return this.a.length;
    }
    peek(): number {
        return this.a[0];
    }
    push(x: number): void {
        const a = this.a;
        a.push(x);
        for (let i = a.length - 1; i > 0 && a[(i - 1) >> 1] > a[i]; i = (i - 1) >> 1) {
            [a[i], a[(i - 1) >> 1]] = [a[(i - 1) >> 1], a[i]];
        }
    }
    pop(): number {
        const a = this.a, top = a[0], last = a.pop()!;
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
    private k: number;
    private heap = new MinHeap();               // 最小堆，只留最大的 k 个数 //@init

    constructor(k: number, nums: number[]) {
        this.k = k;
        for (const x of nums) {                 //@init
            this.add(x);                        //@init
        }
    }

    add(val: number): number {
        this.heap.push(val);                    //@push
        if (this.heap.size() > this.k) {        // 多了一个：最小的那个不可能是前 k 大 //@trim
            this.heap.pop();                    //@trim
        }
        return this.heap.peek();                // 堆顶就是第 k 大 //@top
    }
}
