/**
 * 力扣已经定义好了 ListNode：
 * public class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode() {}
 *     ListNode(int val) { this.val = val; }
 *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }
 * }
 */
class Solution {
    public ListNode buildList(int[] nums) {
        ListNode dummy = new ListNode();        // 哑节点：省掉「链表还是空的」这个特殊情况 //@init
        ListNode tail = dummy;                  //@init
        for (int x : nums) {                    //@loop
            tail.next = new ListNode(x);        // 新建节点，接到尾巴后面 //@link
            tail = tail.next;                   // 尾巴往后挪 //@move
        }
        return dummy.next;                      // 真正的头是哑节点的下一个 //@done
    }
}
