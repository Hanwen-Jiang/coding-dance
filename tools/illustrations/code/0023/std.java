class Solution {
    public ListNode mergeKLists(ListNode[] lists) {
        // 小顶堆，按节点的值比较
        PriorityQueue<ListNode> heap = new PriorityQueue<>((a, b) -> Integer.compare(a.val, b.val));  //@build
        for (ListNode node : lists) {                   //@build
            if (node != null) {                         //@build
                heap.offer(node);                       //@build
            }
        }
        ListNode dummy = new ListNode(), cur = dummy;   //@build
        while (!heap.isEmpty()) {
            ListNode node = heap.poll();                //@pop
            cur.next = node;                            //@pop
            cur = node;                                 //@pop
            if (node.next != null) {                    //@push,end
                heap.offer(node.next);                  //@push
            }
        }
        return dummy.next;                              //@done
    }
}
