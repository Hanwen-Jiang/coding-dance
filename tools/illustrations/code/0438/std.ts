function findAnagrams(s: string, p: string): number[] {
    const m = p.length, res: number[] = [];             //@init
    const need: number[] = new Array(26).fill(0), win: number[] = new Array(26).fill(0);   // 每个字母出现的次数 //@init
    const idx = (c: string): number => c.charCodeAt(0) - 97;    //@init
    for (const c of p) {                                //@init
        need[idx(c)]++;                                 //@init
    }
    for (let r = 0; r < s.length; r++) {
        win[idx(s[r])]++;                               // 右边进 //@in
        if (r >= m) {
            win[idx(s[r - m])]--;                       // 左边出 //@out
        }
        if (win.every((x, i) => x === need[i])) {       //@cmp
            res.push(r - m + 1);                        //@hit
        }
    }
    return res;                                         //@done
}
