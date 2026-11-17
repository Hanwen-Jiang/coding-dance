function findOrder(numCourses: number, prerequisites: number[][]): number[] {
    const graph: number[][] = Array.from({ length: numCourses }, () => []);    // 先修课 -> 后续课 //@init
    const indeg: number[] = new Array(numCourses).fill(0);  // 还差几门先修课 //@init
    for (const [a, b] of prerequisites) {           // 学 a 之前要先学 b：边 b -> a //@init
        graph[b].push(a);                           //@init
        indeg[a]++;                                 //@init
    }
    const q: number[] = [];                         // 现在就能学的课 //@start
    for (let i = 0; i < numCourses; i++) {          //@start
        if (indeg[i] === 0) q.push(i);              //@start
    }
    const order: number[] = [];
    for (let head = 0; head < q.length; head++) {
        const u = q[head];                          //@pop
        order.push(u);                              //@pop
        for (const v of graph[u]) {                 // 学完 u，后续课少了一门先修 //@next
            if (--indeg[v] === 0) {                 // 先修课都学完了 //@next,ready
                q.push(v);                          //@ready
            }
        }
    }
    return order.length === numCourses ? order : [];    // 少了说明有环 //@done
}
