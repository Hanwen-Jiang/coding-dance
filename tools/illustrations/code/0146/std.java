class LRUCache {
    private static class Node {
        int key, val;
        Node prev, next;
        Node(int key, int val) { this.key = key; this.val = val; }
    }

    private final int cap;
    private final Map<Integer, Node> map = new HashMap<>();     // key -> Node //@init
    private final Node head = new Node(0, 0), tail = new Node(0, 0);    // 两个哨兵，省掉判空 //@init

    public LRUCache(int capacity) {
        cap = capacity;         //@init
        head.next = tail;       //@init
        tail.prev = head;       //@init
    }

    private void remove(Node node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    private void addFront(Node node) {
        node.prev = head;
        node.next = head.next;
        head.next.prev = node;
        head.next = node;
    }

    public int get(int key) {
        Node node = map.get(key);
        if (node == null) {     //@miss
            return -1;          //@miss
        }
        remove(node);           // 挪到头部，表示刚用过 //@hit
        addFront(node);         //@hit
        return node.val;        //@hit
    }

    public void put(int key, int value) {
        if (map.containsKey(key)) {         //@old
            remove(map.get(key));           //@old
        }
        Node node = new Node(key, value);   //@put
        map.put(key, node);                 //@put
        addFront(node);                     //@put
        if (map.size() > cap) {             //@evict
            Node last = tail.prev;          // 尾部是最久没用的 //@evict
            remove(last);                   //@evict
            map.remove(last.key);           //@evict
        }
    }
}
