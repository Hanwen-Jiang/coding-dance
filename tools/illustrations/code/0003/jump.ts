function lengthOfLongestSubstring(s: string): number {
    const last = new Map<string, number>();             //@init
    let left = 0, best = 0;                             //@init
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        const p = last.get(c);
        if (p !== undefined && p >= left) {             // c 在窗口里出现过 //@jump,grow
            left = p + 1;                               //@jump
        }
        last.set(c, i);                                 //@jump,grow
        best = Math.max(best, i - left + 1);            //@jump,grow
    }
    return best;                                        //@done
}
