class Solution {
    vector<int> tmp;

    // 排好 record[l..r]，返回里面的逆序对数
    int sort(vector<int>& record, int l, int r) {
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
        copy(tmp.begin() + l, tmp.begin() + r + 1, record.begin() + l);    //@copy
        return cnt;                             //@copy
    }

public:
    int reversePairs(vector<int>& record) {
        tmp.resize(record.size());
        return sort(record, 0, (int)record.size() - 1);     //@done
    }
};
