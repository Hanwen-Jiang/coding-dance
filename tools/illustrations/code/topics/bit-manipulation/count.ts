function hammingWeight(n: number): number {
    let cnt = 0;                                //@init
    while (n) {                                 //@loop
        n &= n - 1;                             // 去掉最低位的 1 //@drop
        cnt++;                                  //@drop
    }
    return cnt;                                 //@done
}
