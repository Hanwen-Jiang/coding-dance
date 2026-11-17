class Solution {
    public int firstUniqChar(String s) {
        Map<Character, Integer> cnt = new HashMap<>();      // 字符 -> 出现次数 //@init
        for (char ch : s.toCharArray()) {                   //@count
            cnt.put(ch, cnt.getOrDefault(ch, 0) + 1);       // 没见过的当作 0 //@count
        }
        for (int i = 0; i < s.length(); i++) {              // 再按原来的顺序找 //@find
            if (cnt.get(s.charAt(i)) == 1) {                //@find
                return i;                                   //@hit
            }
        }
        return -1;                                          //@miss
    }
}
