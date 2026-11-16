/**
 * 力扣已经定义好了 ListNode：
 * function ListNode(val, next) {
 *     this.val = (val === undefined ? 0 : val);
 *     this.next = (next === undefined ? null : next);
 * }
 */
var buildList = function(nums) {
    const dummy = new ListNode();           // 哑节点：省掉「链表还是空的」这个特殊情况 //@init
    let tail = dummy;                       //@init
    for (const x of nums) {                 //@loop
        tail.next = new ListNode(x);        // 新建节点，接到尾巴后面 //@link
        tail = tail.next;                   // 尾巴往后挪 //@move
    }
    return dummy.next;                      // 真正的头是哑节点的下一个 //@done
};
