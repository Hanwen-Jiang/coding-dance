function minWindow(s: string, t: string): string {
    const need = new Map<string, number>();         // 每种字符还差几个 //@init
    for (const c of t) need.set(c, (need.get(c) ?? 0) + 1);     //@init
    let missing = t.length;                         // 一共还差几个 //@init
    let l = 0, start = 0;                           //@init
    let size = Infinity;                            //@init
    for (let r = 0; r < s.length; r++) {            //@grow
        const ch = s[r];                            //@grow
        if ((need.get(ch) ?? 0) > 0) {              //@grow
            missing--;                              //@grow
        }
        need.set(ch, (need.get(ch) ?? 0) - 1);      //@grow
        while (missing === 0) {                     // 窗口合格，尝试收缩 //@shrink
            if (r - l + 1 < size) {                 //@shrink
                start = l;                          //@shrink
                size = r - l + 1;                   //@shrink
            }
            need.set(s[l], need.get(s[l])! + 1);    //@shrink
            if (need.get(s[l])! > 0) {              //@shrink
                missing++;                          //@broke
            }
            l++;                                    //@shrink
        }
    }
    return size === Infinity ? "" : s.slice(start, start + size);   //@done
}
