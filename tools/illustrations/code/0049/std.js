var groupAnagrams = function(strs) {
    const groups = new Map();                           //@init
    for (const s of strs) {
        const key = [...s].sort().join("");             // 异位词排序后相同 //@key
        if (!groups.has(key)) groups.set(key, []);      //@add
        groups.get(key).push(s);                        //@add
    }
    return [...groups.values()];                        //@done
};
