class Solution {
    public ListNode reverseKGroup(ListNode head, int k) {
        ListNode dummy = new ListNode(0, head);     //@dummy
        ListNode groupPrev = dummy;                 //@gp0
        while (true) {
            ListNode kth = groupPrev;               //@kth0
            for (int i = 0; i < k; i++) {           // 往前数 k 个
                kth = kth.next;                     //@kstep
                if (kth == null) {                  //@kchk
                    return dummy.next;              // 不够 k 个，剩下的不动 //@ret
                }
            }
            ListNode groupNext = kth.next;          // 下一组的开头 //@cut
            ListNode prev = groupNext;              // prev 从 groupNext 开始 //@prev0
            ListNode cur = groupPrev.next;          //@cur0
            while (cur != groupNext) {              // 组内反转 //@exit
                ListNode nxt = cur.next;            // 先记住下一个 //@save
                cur.next = prev;                    // 箭头掉头 //@flip
                prev = cur;                         //@mprev
                cur = nxt;                          //@mcur
            }
            ListNode first = groupPrev.next;        // 这组原来的头，现在是尾 //@first
            groupPrev.next = kth;                   // 前面接上新的头 //@link
            groupPrev = first;                      //@next
        }
    }
}
