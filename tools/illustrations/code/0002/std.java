class Solution {
    public ListNode addTwoNumbers(ListNode l1, ListNode l2) {
        ListNode dummy = new ListNode(), cur = dummy;   //@init
        int carry = 0;                                  //@init
        while (l1 != null || l2 != null || carry != 0) {
            int total = carry;                          //@add
            if (l1 != null) {
                total += l1.val;                        //@add
                l1 = l1.next;                           //@add
            }
            if (l2 != null) {
                total += l2.val;                        //@add
                l2 = l2.next;                           //@add
            }
            carry = total / 10;                         //@digit
            cur.next = new ListNode(total % 10);        //@digit
            cur = cur.next;                             //@digit
        }
        return dummy.next;                              //@done
    }
}
