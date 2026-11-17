function reversePairs(record: number[]): number {
    const tmp: number[] = new Array(record.length);
    // 排好 record[l..r]，返回里面的逆序对数
    const sort = (l: number, r: number): number => {
        if (l >= r) {                           //@base
            return 0;                           //@base
        }
        const mid = (l + r) >> 1;               //@split
        let cnt = sort(l, mid) + sort(mid + 1, r);  // 两半内部的逆序对 //@split
        let i = l, j = mid + 1, k = l;          //@merge
        while (i <= mid && j <= r) {            //@merge
            if (record[i] <= record[j]) {       //@take
                tmp[k++] = record[i++];         //@take
            } else {                            // 右边的更小：左边剩下的都比它大 //@cross
                cnt += mid - i + 1;             //@cross
                tmp[k++] = record[j++];         //@cross
            }
        }
        while (i <= mid) {                      //@rest
            tmp[k++] = record[i++];             //@rest
        }
        while (j <= r) {                        //@rest
            tmp[k++] = record[j++];             //@rest
        }
        for (let x = l; x <= r; x++) {          //@copy
            record[x] = tmp[x];                 //@copy
        }
        return cnt;                             //@copy
    };
    return sort(0, record.length - 1);          //@done
}
