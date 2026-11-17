class Solution {
    private int[] tmp;

    public int reversePairs(int[] record) {
        tmp = new int[record.length];
        return sort(record, 0, record.length - 1);  //@done
    }

    // 排好 record[l..r]，返回里面的逆序对数
    private int sort(int[] record, int l, int r) {
        if (l >= r) {                           //@base
            return 0;                           //@base
        }
        int mid = l + (r - l) / 2;              //@split
        int cnt = sort(record, l, mid) + sort(record, mid + 1, r);  // 两半内部的逆序对 //@split
        int i = l, j = mid + 1, k = l;          //@merge
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
        System.arraycopy(tmp, l, record, l, r - l + 1);     //@copy
        return cnt;                             //@copy
    }
}
