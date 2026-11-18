// 判题程序的 Dart 部分（接在用户代码后面）：力扣 Dart 环境里现成的两个节点类型、建参数、把结果写成 JSON
class ListNode {
  int val;
  ListNode? next;
  ListNode([this.val = 0, this.next]);
}

class TreeNode {
  int val;
  TreeNode? left;
  TreeNode? right;
  TreeNode([this.val = 0, this.left, this.right]);
}

class JH {
  // 本用例建出的节点：要按「是不是同一个节点」判的题用（见 judge/util.js 里的类型说明）
  static List<ListNode> nodes = [];
  static TreeNode? lastTree;

  static void reset() {
    nodes = [];
    lastTree = null;
  }

  static ListNode? list(List<int> v) {
    final dummy = ListNode(0);
    var cur = dummy;
    for (final x in v) {
      final n = ListNode(x);
      cur.next = n;
      cur = n;
      nodes.add(n);
    }
    return dummy.next;
  }

  static ListNode? cycle(List<int> v, int pos) {
    final s = nodes.length;
    final head = list(v);
    if (pos >= 0 && v.isNotEmpty) nodes[s + v.length - 1].next = nodes[s + pos];
    return head;
  }

  static ListNode? join(List<int> v, int k) {
    final tail = k >= 0 ? nodes[k] : null;
    final s = nodes.length;
    final head = list(v);
    if (v.isEmpty) return tail;
    nodes[s + v.length - 1].next = tail;
    return head;
  }

  static Object? index(ListNode? n) {
    if (n == null) return null;
    for (var i = 0; i < nodes.length; i++) {
      if (identical(nodes[i], n)) return i;
    }
    return "不是输入里的节点";
  }

  static TreeNode? tree(List<int?> v) {
    lastTree = null;
    if (v.isEmpty || v[0] == null) return null;
    final root = TreeNode(v[0]!);
    final q = <TreeNode>[root];
    var i = 1, h = 0;
    while (i < v.length && h < q.length) {
      final node = q[h++];
      if (v[i] != null) {
        node.left = TreeNode(v[i]!);
        q.add(node.left!);
      }
      i++;
      if (i < v.length) {
        if (v[i] != null) {
          node.right = TreeNode(v[i]!);
          q.add(node.right!);
        }
        i++;
      }
    }
    lastTree = root;
    return root;
  }

  static TreeNode? find(int v) {
    final st = <TreeNode>[];
    if (lastTree != null) st.add(lastTree!);
    while (st.isNotEmpty) {
      final t = st.removeLast();
      if (t.val == v) return t;
      if (t.left != null) st.add(t.left!);
      if (t.right != null) st.add(t.right!);
    }
    return null;
  }

  static Object? treeVal(TreeNode? n) => n?.val;

  static String json(Object? o) {
    final sb = StringBuffer();
    _w(sb, o);
    return sb.toString();
  }

  static String q(String s) {
    final sb = StringBuffer();
    _q(sb, s);
    return sb.toString();
  }

  static void _q(StringBuffer sb, String s) {
    sb.write('"');
    for (final c in s.runes) {
      if (c == 0x22 || c == 0x5c) {
        sb.write('\\');
        sb.writeCharCode(c);
      } else if (c == 0x0a) {
        sb.write('\\n');
      } else if (c == 0x0d) {
        sb.write('\\r');
      } else if (c == 0x09) {
        sb.write('\\t');
      } else if (c < 0x20) {
        sb.write('\\u${c.toRadixString(16).padLeft(4, '0')}');
      } else {
        sb.writeCharCode(c);
      }
    }
    sb.write('"');
  }

  static void _seq(StringBuffer sb, Iterable<Object?> it) {
    sb.write('[');
    var first = true;
    for (final x in it) {
      if (!first) sb.write(',');
      first = false;
      _w(sb, x);
    }
    sb.write(']');
  }

  static void _w(StringBuffer sb, Object? o) {
    if (o == null) {
      sb.write('null');
    } else if (o is bool || o is int) {
      sb.write(o.toString());
    } else if (o is double) {
      sb.write(o.isFinite ? o.toString() : 'null');
    } else if (o is String) {
      _q(sb, o);
    } else if (o is ListNode) {
      final out = <int>[];
      ListNode? p = o;
      while (p != null && out.length < 100000) {
        out.add(p.val);
        p = p.next;
      }
      _seq(sb, out);
    } else if (o is TreeNode) {
      final q = <TreeNode?>[o];
      final vals = <int?>[];
      var h = 0;
      while (h < q.length && q.length < 400000) {
        final t = q[h++];
        if (t == null) {
          vals.add(null);
        } else {
          vals.add(t.val);
          q.add(t.left);
          q.add(t.right);
        }
      }
      while (vals.isNotEmpty && vals.last == null) {
        vals.removeLast();
      }
      _seq(sb, vals);
    } else if (o is Iterable) {
      _seq(sb, o.cast<Object?>());
    } else {
      _q(sb, o.toString());
    }
  }
}
