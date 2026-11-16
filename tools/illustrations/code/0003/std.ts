function lengthOfLongestSubstring(s: string): number {
    const seen = new Set<string>();             // 窗口里的字符 //@init
    let l = 0, best = 0;                        //@init
    for (let r = 0; r < s.length; r++) {
        const ch = s[r];
        while (seen.has(ch)) {                  // 有重复，左端收缩 //@shrink
            seen.delete(s[l]);                  //@shrink
            l++;                                //@shrink
        }
        seen.add(ch);                           //@grow
        best = Math.max(best, r - l + 1);       //@grow
    }
    return best;                                //@done
}
