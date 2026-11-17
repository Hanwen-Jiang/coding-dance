function validPath(n: number, edges: number[][], source: number, destination: number): boolean {
    const graph: number[][] = Array.from({ length: n }, () => []);  // graph[u] 是 u 的所有邻居 //@init
    for (const [u, v] of edges) {                       //@edge
        graph[u].push(v);                               // 无向图：两个方向都要加 //@edge
        graph[v].push(u);                               //@edge
    }
    const seen: boolean[] = new Array(n).fill(false);   //@start
    seen[source] = true;                                //@start
    const stack: number[] = [source];                   //@start
    while (stack.length) {
        const u = stack.pop()!;                         //@pop
        if (u === destination) {                        //@found
            return true;                                //@found
        }
        for (const v of graph[u]) {                     // 只看和 u 相连的点 //@next
            if (!seen[v]) {                             //@next
                seen[v] = true;                         //@next
                stack.push(v);                          //@next
            }
        }
    }
    return false;                                       //@done
}
