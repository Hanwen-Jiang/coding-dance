// JavaScript 没有内置的堆，写一个最小的：less(a, b) 为真时 a 更靠近堆顶
class Heap {
    constructor(less) { this.a = []; this.less = less; }
    size() { return this.a.length; }
    peek() { return this.a[0]; }
    push(x) {
        const a = this.a;
        a.push(x);
        for (let i = a.length - 1; i > 0;) {
            const p = (i - 1) >> 1;
            if (!this.less(a[i], a[p])) break;
            [a[i], a[p]] = [a[p], a[i]];
            i = p;
        }
    }
    pop() {
        const a = this.a, top = a[0], last = a.pop();
        if (a.length) {
            a[0] = last;
            for (let i = 0; ;) {
                const l = 2 * i + 1, r = l + 1;
                let m = i;
                if (l < a.length && this.less(a[l], a[m])) m = l;
                if (r < a.length && this.less(a[r], a[m])) m = r;
                if (m === i) break;
                [a[i], a[m]] = [a[m], a[i]];
                i = m;
            }
        }
        return top;
    }
}

var MedianFinder = function() {
    this.lo = new Heap((x, y) => x > y);            // 大顶堆，较小的一半 //@init
    this.hi = new Heap((x, y) => x < y);            // 小顶堆，较大的一半 //@init
};

MedianFinder.prototype.addNum = function(num) {
    this.lo.push(num);                              //@add
    this.hi.push(this.lo.pop());                    // lo 的最大值挪到 hi //@add
    if (this.hi.size() > this.lo.size()) {          // 保持 lo 不比 hi 少 //@add,rebal
        this.lo.push(this.hi.pop());                //@rebal
    }
};

MedianFinder.prototype.findMedian = function() {
    if (this.lo.size() > this.hi.size()) {          //@odd,even
        return this.lo.peek();                      //@odd
    }
    return (this.lo.peek() + this.hi.peek()) / 2;   //@even
};
