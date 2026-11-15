class DNode {
    key: number;
    val: number;
    prev: DNode | null = null;
    next: DNode | null = null;
    constructor(key = 0, val = 0) {
        this.key = key;
        this.val = val;
    }
}

class LRUCache {
    private cap: number;
    private map = new Map<number, DNode>();     // key -> 节点
    private head = new DNode();                 // 两个哨兵，省掉判空
    private tail = new DNode();

    constructor(capacity: number) {
        this.cap = capacity;            //@init
        this.head.next = this.tail;     //@init
        this.tail.prev = this.head;     //@init
    }

    private remove(node: DNode): void {
        node.prev!.next = node.next;
        node.next!.prev = node.prev;
    }

    private addFront(node: DNode): void {
        node.prev = this.head;
        node.next = this.head.next;
        this.head.next!.prev = node;
        this.head.next = node;
    }

    get(key: number): number {
        const node = this.map.get(key);
        if (!node) {                    //@miss
            return -1;                  //@miss
        }
        this.remove(node);              // 挪到头部，表示刚用过 //@hit
        this.addFront(node);            //@hit
        return node.val;                //@hit
    }

    put(key: number, value: number): void {
        const old = this.map.get(key);
        if (old) {                              //@old
            this.remove(old);                   //@old
        }
        const node = new DNode(key, value);     //@put
        this.map.set(key, node);                //@put
        this.addFront(node);                    //@put
        if (this.map.size > this.cap) {         //@evict
            const last = this.tail.prev!;       // 尾部是最久没用的 //@evict
            this.remove(last);                  //@evict
            this.map.delete(last.key);          //@evict
        }
    }
}
