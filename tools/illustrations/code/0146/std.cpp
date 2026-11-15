class LRUCache {
    struct Node {
        int key, val;
        Node *prev, *next;
        Node(int k, int v) : key(k), val(v), prev(nullptr), next(nullptr) {}
    };

    int cap;
    unordered_map<int, Node*> map;      // key -> Node
    Node *head, *tail;                  // 两个哨兵，省掉判空

    void remove(Node* node) {
        node->prev->next = node->next;
        node->next->prev = node->prev;
    }

    void addFront(Node* node) {
        node->prev = head;
        node->next = head->next;
        head->next->prev = node;
        head->next = node;
    }

public:
    LRUCache(int capacity) {
        cap = capacity;                 //@init
        head = new Node(0, 0);          //@init
        tail = new Node(0, 0);          //@init
        head->next = tail;              //@init
        tail->prev = head;              //@init
    }

    int get(int key) {
        auto it = map.find(key);
        if (it == map.end()) {          //@miss
            return -1;                  //@miss
        }
        Node* node = it->second;        //@hit
        remove(node);                   // 挪到头部，表示刚用过 //@hit
        addFront(node);                 //@hit
        return node->val;               //@hit
    }

    void put(int key, int value) {
        auto it = map.find(key);
        if (it != map.end()) {          //@old
            remove(it->second);         //@old
            delete it->second;          //@old
        }
        Node* node = new Node(key, value);  //@put
        map[key] = node;                //@put
        addFront(node);                 //@put
        if ((int)map.size() > cap) {    //@evict
            Node* last = tail->prev;    // 尾部是最久没用的 //@evict
            remove(last);               //@evict
            map.erase(last->key);       //@evict
            delete last;                //@evict
        }
    }
};
