class MinHeap {
    private a: number[] = [];                               // i 的孩子是 2i+1、2i+2 //@init

    push(x: number): void {
        const a = this.a;
        a.push(x);                                          // 先放到最后 //@push
        let i = a.length - 1;                               //@push
        while (i > 0 && a[(i - 1) >> 1] > a[i]) {           // 比父节点小就往上换 //@up
            const p = (i - 1) >> 1;                         //@up
            [a[i], a[p]] = [a[p], a[i]];                    //@up
            i = p;                                          //@up
        }
    }

    pop(): number {
        const a = this.a;
        const top = a[0];                                   //@pop
        const last = a.pop()!;                              //@pop
        if (!a.length) {                                    //@pop
            return top;                                     //@pop
        }
        a[0] = last;                                        // 最后一个挪到堆顶 //@pop
        let i = 0;
        while (true) {
            let small = i;                                  //@down
            const l = 2 * i + 1, r = 2 * i + 2;             //@down
            if (l < a.length && a[l] < a[small]) {          //@down
                small = l;                                  //@down
            }
            if (r < a.length && a[r] < a[small]) {          //@down
                small = r;                                  //@down
            }
            if (small === i) {                              // 两个孩子都不比它小 //@stop
                break;                                      //@stop
            }
            [a[i], a[small]] = [a[small], a[i]];            //@down
            i = small;                                      //@down
        }
        return top;                                         //@ret
    }

    peek(): number {
        return this.a[0];                                   //@peek
    }

    size(): number {
        return this.a.length;                               //@size
    }
}
