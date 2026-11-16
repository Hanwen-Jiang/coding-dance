class Solution {
public:
    string decodeString(string s) {
        regex inner("(\\d+)\\[([a-z]*)\\]");                    //@init
        while (s.find('[') != string::npos) {                   //@round
            string out;                                         //@round
            auto from = s.cbegin();                             //@round
            smatch m;
            while (regex_search(from, s.cend(), m, inner)) {    //@expand
                out += m.prefix().str();                        //@expand
                for (int k = stoi(m[1].str()); k > 0; k--) out += m[2].str();   //@expand
                from = m[0].second;                             //@expand
            }
            out.append(from, s.cend());                         //@expand
            s = out;                                            //@expand
        }
        return s;                                               //@done
    }
};
