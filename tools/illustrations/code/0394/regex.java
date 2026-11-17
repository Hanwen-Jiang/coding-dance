import java.util.regex.*;

class Solution {
    public String decodeString(String s) {
        Pattern inner = Pattern.compile("(\\d+)\\[([a-z]*)\\]");   //@init
        while (s.contains("[")) {                                   //@round
            s = inner.matcher(s).replaceAll(m -> m.group(2).repeat(Integer.parseInt(m.group(1))));   //@expand
        }
        return s;                                                   //@done
    }
}
