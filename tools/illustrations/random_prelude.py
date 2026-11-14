# 核对随机演示时用的辅助函数：把 random.js 里的 py 表达式需要的输入搭起来，把输出转成和演示一样的格式
import json


def __inplace(f, a, *rest):
    f(a, *rest)
    return a


class Node:  # 138 随机链表
    def __init__(self, x, next=None, random=None):
        self.val, self.next, self.random = x, next, random


def __mk138(data):
    nodes = [Node(v) for v, _ in data]
    for i, (_, r) in enumerate(data):
        if i + 1 < len(nodes):
            nodes[i].next = nodes[i + 1]
        nodes[i].random = nodes[r] if r is not None else None
    return nodes[0] if nodes else None


def __dump138(head):
    nodes = []
    while head:
        nodes.append(head)
        head = head.next
    index = {id(n): i for i, n in enumerate(nodes)}
    return [[n.val, index[id(n.random)] if n.random else None] for n in nodes]


def __cyc(vals, pos):
    nodes = [ListNode(v) for v in vals]
    for a, b in zip(nodes, nodes[1:]):
        a.next = b
    if pos >= 0:
        nodes[-1].next = nodes[pos]
    return nodes[0]


def __idx(vals, pos):
    nodes = [ListNode(v) for v in vals]
    for a, b in zip(nodes, nodes[1:]):
        a.next = b
    if pos >= 0:
        nodes[-1].next = nodes[pos]
    hit = Solution().detectCycle(nodes[0])
    return next((i for i, n in enumerate(nodes) if n is hit), None)


def __inter(xa, xb, cm):
    common = L(cm)
    def build(xs):
        head = L(xs)
        if not head:
            return common
        cur = head
        while cur.next:
            cur = cur.next
        cur.next = common
        return head
    return build(xa), build(xb)


def __n160(node):
    return node.val if node else None


def __ops(obj, ops, alias=None):
    alias = alias or {}
    return [getattr(obj, alias.get(o[0], o[0]))(*o[1:]) for o in ops]


def __pre(root):
    return [root.val] + __pre(root.left) + __pre(root.right) if root else []


def __flat(root):
    Solution().flatten(root)
    out = []
    while root:
        out.append(root.val)
        root = root.right
    return out


def __lv(root):
    out, q = [], deque([root] if root else [])
    while q:
        n = q.popleft()
        out.append(n.val)
        for c in (n.left, n.right):
            if c:
                q.append(c)
    return out
