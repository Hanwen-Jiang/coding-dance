class Solution {
    private static class Node {
        Node[] children = new Node[26];
        boolean end;                                // 有词根在这里结束
    }

    public String replaceWords(List<String> dictionary, String sentence) {
        Node root = new Node();                     //@build
        for (String w : dictionary) {               //@build
            Node node = root;                       //@build
            for (char ch : w.toCharArray()) {       //@build
                if (node.children[ch - 'a'] == null) {      //@build
                    node.children[ch - 'a'] = new Node();   //@build
                }
                node = node.children[ch - 'a'];     //@build
            }
            node.end = true;                        //@build
        }
        List<String> res = new ArrayList<>();
        for (String word : sentence.split(" ")) {   //@word
            Node node = root;                       //@word
            String cut = word;                      //@word
            for (int i = 0; i < word.length(); i++) {   //@walk
                node = node.children[word.charAt(i) - 'a'];     // 路断了就是没有词根是它的前缀 //@walk
                if (node == null) {                 //@walk
                    break;                          //@walk
                }
                if (node.end) {                     // 第一次碰到结束标记：最短的词根 //@hit
                    cut = word.substring(0, i + 1); //@hit
                    break;                          //@hit
                }
            }
            res.add(cut);                           //@add
        }
        return String.join(" ", res);               //@done
    }
}
