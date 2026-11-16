function decodeString(s: string): string {
    const stack: [string, number][] = [];           //@init
    let cur = "", k = 0;                            //@init
    for (const c of s) {
        if (c >= "0" && c <= "9") {                 //@digit
            k = k * 10 + Number(c);                 // 数字可能不止一位 //@digit
        } else if (c === "[") {                     //@push
            stack.push([cur, k]);                   // 存档：括号外的前缀和重复次数 //@push
            cur = "";                               //@push
            k = 0;                                  //@push
        } else if (c === "]") {                     //@pop
            const [prev, times] = stack.pop()!;     //@pop
            cur = prev + cur.repeat(times);         // 展开后接回前缀 //@pop
        } else {                                    //@letter
            cur += c;                               //@letter
        }
    }
    return cur;                                     //@done
}
