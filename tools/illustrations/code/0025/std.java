class Solution {
    public ListNode reverseKGroup(ListNode head, int k) {
        ListNode dummy = new ListNode(0, head);     //@init
        ListNode groupPrev = dummy;                 //@init
        while (true) {                              //@count
            ListNode kth = groupPrev;               //@count
            for (int i = 0; i < k; i++) {           // 往前数 k 个 //@count
                kth = kth.next;                     //@count
                if (kth == null) {                  //@count
                    return dummy.next;              // 不够 k 个，剩下的不动 //@done
                }
            }
            ListNode groupNext = kth.next;          // 下一组的开头 //@cut
            ListNode prev = groupNext, cur = groupPrev.next;    // prev 从 groupNext 开始 //@setup
            while (cur != groupNext) {              // 组内反转 //@flip
                ListNode nxt = cur.next;            // 先记住下一个 //@flip
                cur.next = prev;                    // 箭头掉头 //@flip
                prev = cur;                         //@move
                cur = nxt;                          //@move
            }
            ListNode first = groupPrev.next;        // 这组原来的头，现在是尾 //@link
            groupPrev.next = kth;                   // 前面接上新的头 //@link
            groupPrev = first;                      //@next
        }
    }
}
