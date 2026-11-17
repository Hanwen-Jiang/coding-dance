function corpFlightBookings(bookings: number[][], n: number): number[] {
    const diff: number[] = new Array(n + 1).fill(0);    // diff[i] = ans[i] - ans[i-1] //@init
    for (const [first, last, seats] of bookings) {      //@add
        diff[first - 1] += seats;               // 从 first 开始多了 seats //@add
        diff[last] -= seats;                    // 过了 last 又少了 seats //@add
    }
    const ans: number[] = new Array(n);
    let cur = 0;
    for (let i = 0; i < n; i++) {               //@sum
        cur += diff[i];                         // 前缀和还原出每个位置的值 //@sum
        ans[i] = cur;                           //@sum
    }
    return ans;                                 //@done
}
