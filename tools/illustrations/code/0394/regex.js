var decodeString = function(s) {
    const inner = /(\d+)\[([a-z]*)\]/g;                 //@init
    while (s.includes("[")) {                           //@round
        s = s.replace(inner, (_, k, t) => t.repeat(Number(k)));    //@expand
    }
    return s;                                           //@done
};
