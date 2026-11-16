var partitionLabels = function(s) {
    const last = {};                                // 每个字母最后出现的位置 //@init
    for (let i = 0; i < s.length; i++) last[s[i]] = i;  //@init
    const res = [];                                 //@init
    let start = 0, end = 0;                         //@init
    for (let i = 0; i < s.length; i++) {            //@grow
        end = Math.max(end, last[s[i]]);            // 这一段至少要到 end //@grow
        if (i === end) {                            // 走到边界，切一刀 //@cut
            res.push(end - start + 1);              //@cut
            start = i + 1;                          //@cut
        }
    }
    return res;                                     //@done
};
