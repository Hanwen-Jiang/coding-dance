var partition = function(s) {
    const res = [], path = [];                      //@init
    const dfs = (start) => {
        if (start === s.length) {                   //@collect
            res.push([...path]);                    //@collect
            return;                                 //@collect
        }
        for (let end = start + 1; end <= s.length; end++) {     //@try
            const piece = s.slice(start, end);      //@try
            if (piece === [...piece].reverse().join("")) {      // 这一段是回文才切 //@try,cut
                path.push(piece);                   //@cut
                dfs(end);                           //@cut
                path.pop();                         //@back
            }
        }
    };
    dfs(0);                                         //@init
    return res;                                     //@done
};
