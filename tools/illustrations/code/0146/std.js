class Node {
    constructor(key = 0, val = 0) {
        this.key = key;
        this.val = val;
        this.prev = null;
        this.next = null;
    }
}

class LRUCache {
    constructor(capacity) {
        this.cap = capacity;            //@init
        this.map = new Map();           // key -> Node //@init
        this.head = new Node();         // 两个哨兵，省掉判空 //@init
        this.tail = new Node();         //@init
        this.head.next = this.tail;     //@init
        this.tail.prev = this.head;     //@init
    }

    remove(node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    addFront(node) {
        node.prev = this.head;
        node.next = this.head.next;
        this.head.next.prev = node;
        this.head.next = node;
    }

    get(key) {
        const node = this.map.get(key);
        if (!node) {                    //@miss
            return -1;                  //@miss
        }
        this.remove(node);              // 挪到头部，表示刚用过 //@hit
        this.addFront(node);            //@hit
        return node.val;                //@hit
    }

    put(key, value) {
        if (this.map.has(key)) {                //@old
            this.remove(this.map.get(key));     //@old
        }
        const node = new Node(key, value);      //@put
        this.map.set(key, node);                //@put
        this.addFront(node);                    //@put
        if (this.map.size > this.cap) {         //@evict
            const last = this.tail.prev;        // 尾部是最久没用的 //@evict
            this.remove(last);                  //@evict
            this.map.delete(last.key);          //@evict
        }
    }
}
