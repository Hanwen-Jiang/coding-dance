interface RootNode {
    [ch: string]: RootNode | undefined;
}

function replaceWords(dictionary: string[], sentence: string): string {
    const root: RootNode = {};                  // 嵌套的对象当节点，"#" 表示有词根在这里结束 //@build
    for (const w of dictionary) {               //@build
        let node = root;                        //@build
        for (const ch of w) {                   //@build
            node = node[ch] ??= {};             //@build
        }
        node["#"] = {};                         //@build
    }
    const res: string[] = [];
    for (const word of sentence.split(" ")) {   //@word
        let node: RootNode | undefined = root, cut = word;  //@word
        for (let i = 0; i < word.length; i++) { //@walk
            node = node[word[i]];               // 路断了就是没有词根是它的前缀 //@walk
            if (!node) {                        //@walk
                break;                          //@walk
            }
            if (node["#"]) {                    // 第一次碰到结束标记：最短的词根 //@hit
                cut = word.slice(0, i + 1);     //@hit
                break;                          //@hit
            }
        }
        res.push(cut);                          //@add
    }
    return res.join(" ");                       //@done
}
