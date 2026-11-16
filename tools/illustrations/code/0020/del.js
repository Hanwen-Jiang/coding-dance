var isValid = function(s) {
    while (s.includes("()") || s.includes("[]") || s.includes("{}")) {     //@round
        s = s.split("()").join("").split("[]").join("").split("{}").join("");  //@del
    }
    return s === "";                                //@done
};
