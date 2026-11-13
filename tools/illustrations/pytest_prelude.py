from typing import List, Optional
import collections, heapq, random
from collections import deque, defaultdict, Counter, OrderedDict

class ListNode:
    def __init__(self, val=0, next=None):
        self.val, self.next = val, next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val, self.left, self.right = val, left, right

def L(vals):
    d = cur = ListNode()
    for v in vals:
        cur.next = ListNode(v); cur = cur.next
    return d.next

def toL(head, limit=10000):
    out = []
    while head and limit:
        out.append(head.val); head = head.next; limit -= 1
    return out

def T(vals):
    if not vals: return None
    it = iter(vals); root = TreeNode(next(it)); q = deque([root])
    while q:
        n = q.popleft()
        for side in ("left", "right"):
            v = next(it, None)
            if v is not None:
                c = TreeNode(v); setattr(n, side, c); q.append(c)
    return root

def toT(root):
    out, q = [], deque([root])
    while q:
        n = q.popleft()
        if n is None: out.append(None); continue
        out.append(n.val); q.append(n.left); q.append(n.right)
    while out and out[-1] is None: out.pop()
    return out
