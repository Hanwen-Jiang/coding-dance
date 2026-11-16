var merge = function(intervals) {
    intervals.sort((x, y) => x[0] - y[0]);          // 先按起点排 //@sort
    const res = [];                                 //@sort
    for (const [a, b] of intervals) {
        if (res.length && a <= res[res.length - 1][1]) {    //@merge
            const last = res[res.length - 1];       //@merge
            last[1] = Math.max(last[1], b);         // 重叠，延长终点 //@merge
        } else {
            res.push([a, b]);                       // 不重叠，另起一段 //@new
        }
    }
    return res;                                     //@done
};
