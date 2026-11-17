// TypeScript 没有内置的堆，这里手写一个最大堆（力扣的 TypeScript 环境里可以直接用 MaxPriorityQueue）
class MaxHeap {
    private a: number[] = [];
    size(): number {
        return this.a.length;
    }
    push(x: number): void {
        const a = this.a;
        a.push(x);
        for (let i = a.length - 1; i > 0 && a[(i - 1) >> 1] < a[i]; i = (i - 1) >> 1) {
            [a[i], a[(i - 1) >> 1]] = [a[(i - 1) >> 1], a[i]];
        }
    }
    pop(): number {
        const a = this.a, top = a[0], last = a.pop()!;
        if (a.length) {
            a[0] = last;
            for (let i = 0; ;) {
                let big = i;
                for (const c of [2 * i + 1, 2 * i + 2]) {
                    if (c < a.length && a[c] > a[big]) big = c;
                }
                if (big === i) break;
                [a[i], a[big]] = [a[big], a[i]];
                i = big;
            }
        }
        return top;
    }
}

function lastStoneWeight(stones: number[]): number {
    const heap = new MaxHeap();                 //@init
    for (const x of stones) {                   //@init
        heap.push(x);                           //@init
    }
    while (heap.size() > 1) {                   //@loop
        const y = heap.pop();                   // 最重的 //@pop
        const x = heap.pop();                   // 第二重的 //@pop
        if (x !== y) {                          //@push
            heap.push(y - x);                   // 碎了还剩 y - x //@push
        }
    }
    return heap.size() ? heap.pop() : 0;        //@done
}
