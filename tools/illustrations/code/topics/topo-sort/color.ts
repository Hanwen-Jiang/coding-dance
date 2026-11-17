function eventualSafeNodes(graph: number[][]): number[] {
    const color: number[] = new Array(graph.length).fill(0);    // 0 没走过，1 正在走（在递归栈上），2 安全 //@init
    const safe = (u: number): boolean => {
        if (color[u]) {                         // 走过了：1 说明绕回来了，有环 //@seen
            return color[u] === 2;              //@seen
        }
        color[u] = 1;                           //@enter
        for (const v of graph[u]) {             //@next
            if (!safe(v)) {                     // 能走到环上，u 也不安全 //@next
                return false;                   //@next
            }
        }
        color[u] = 2;                           // 走出去的路都安全 //@safe
        return true;                            //@safe
    };
    return graph.map((_, u) => u).filter((u) => safe(u));  //@done
}
