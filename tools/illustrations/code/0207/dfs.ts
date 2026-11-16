function canFinish(numCourses: number, prerequisites: number[][]): boolean {
    const graph: number[][] = Array.from({ length: numCourses }, () => []);    //@init
    for (const [a, b] of prerequisites) {           //@init
        graph[a].push(b);                           //@init
    }
    const state: number[] = new Array(numCourses).fill(0);     // 0 没访问，1 在递归路径上，2 确认没问题 //@init
    const ok = (u: number): boolean => {
        if (state[u]) {                             //@seen,cycle
            return state[u] === 2;                  //@seen,cycle
        }
        state[u] = 1;                               //@enter
        if (!graph[u].every((v) => ok(v))) {        //@enter
            return false;                           //@cycle
        }
        state[u] = 2;                               //@confirm
        return true;                                //@confirm
    };
    for (let u = 0; u < numCourses; u++) {          //@init,done
        if (!ok(u)) {                               //@init,done
            return false;                           //@done
        }
    }
    return true;                                    //@done
}
