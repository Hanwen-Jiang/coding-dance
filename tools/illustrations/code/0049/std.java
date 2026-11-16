class Solution {
    public List<List<String>> groupAnagrams(String[] strs) {
        Map<String, List<String>> groups = new HashMap<>();     //@init
        for (String s : strs) {
            char[] cs = s.toCharArray();                        //@key
            Arrays.sort(cs);                                    // 异位词排序后相同 //@key
            String key = new String(cs);                        //@key
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(s);     //@add
        }
        return new ArrayList<>(groups.values());                //@done
    }
}
