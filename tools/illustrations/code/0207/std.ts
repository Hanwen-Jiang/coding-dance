function canFinish(numCourses: number, prerequisites: number[][]): boolean {
    const graph: number[][] = Array.from({ length: numCourses }, () => []);    //@init
    const indeg: number[] = new Array(numCourses).fill(0);     // 还有几门先修课没上 //@init
    for (const [a, b] of prerequisites) {           // 先上 b 才能上 a //@init
        graph[b].push(a);                           //@init
        indeg[a]++;                                 //@init
    }
    const q: number[] = [];                         //@init
    for (let i = 0; i < numCourses; i++) {          //@init
        if (indeg[i] === 0) q.push(i);              //@init
    }
    let done = 0;                                   //@init
    for (let h = 0; h < q.length; h++) {            // h 是队头，数组只往后加
        const b = q[h];                             //@take
        done++;                                     //@take
        for (const a of graph[b]) {                 //@take
            if (--indeg[a] === 0) {                 // 先修课都上完了 //@take
                q.push(a);                          //@take
            }
        }
    }
    return done === numCourses;                     // 环上的课永远上不了 //@done
}
