var isPalindrome = function(head) {
    let slow = head, fast = head;               //@init
    while (fast && fast.next) {                 // 找中点 //@mid
        slow = slow.next;                       //@mid
        fast = fast.next.next;                  //@mid
    }
    let prev = null;                            //@rev
    while (slow) {                              // 反转后半段 //@rev
        const nxt = slow.next;                  //@rev
        slow.next = prev;                       //@rev
        prev = slow;                            //@rev
        slow = nxt;                             //@rev
    }
    let left = head, right = prev;              //@cmp
    while (right) {                             // 两头往中间比 //@cmp
        if (left.val !== right.val) {           //@cmp,bad
            return false;                       //@bad
        }
        left = left.next;                       //@cmp
        right = right.next;                     //@cmp
    }
    return true;                                //@done
};
