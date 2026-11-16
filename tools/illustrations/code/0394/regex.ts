function decodeString(s: string): string {
    const inner = /(\d+)\[([a-z]*)\]/g;                 //@init
    while (s.includes("[")) {                           //@round
        s = s.replace(inner, (_, k: string, t: string) => t.repeat(Number(k)));  //@expand
    }
    return s;                                           //@done
}
