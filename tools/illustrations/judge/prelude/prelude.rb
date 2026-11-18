# 判题程序的 Ruby 部分（放在用户代码前面）：力扣 Ruby 环境里现成的节点类型；按签名把 JSON 输入变成参数、把结果变回 JSON（和 runner.py 同一套）
require 'json'
require 'set'

class ListNode
  attr_accessor :val, :next
  def initialize(val = 0, _next = nil)
    @val = val
    @next = _next
  end
end

class TreeNode
  attr_accessor :val, :left, :right
  def initialize(val = 0, left = nil, right = nil)
    @val = val
    @left = left
    @right = right
  end
end

class Node
  attr_accessor :val, :next, :random
  def initialize(val = 0)
    @val = val
    @next = nil
    @random = nil
  end
end

module JudgeH
  # 本用例建出的节点：要按「是不是同一个节点」判的题用（见 judge/util.js 里的类型说明）
  @ctx = { nodes: [], tree: nil, made: [] }

  def self.reset
    @ctx = { nodes: [], tree: nil, made: [] }
  end

  def self.list(vals)
    nodes = vals.map { |v| ListNode.new(v) }
    nodes.each_cons(2) { |a, b| a.next = b }
    @ctx[:nodes].concat(nodes)
    nodes
  end

  def self.tree(vals)
    return nil if vals.empty? || vals[0].nil?
    root = TreeNode.new(vals[0])
    q = [root]
    i = 1
    h = 0
    while i < vals.length && h < q.length
      node = q[h]
      h += 1
      unless vals[i].nil?
        node.left = TreeNode.new(vals[i])
        q << node.left
      end
      i += 1
      if i < vals.length
        unless vals[i].nil?
          node.right = TreeNode.new(vals[i])
          q << node.right
        end
        i += 1
      end
    end
    root
  end

  def self.find(root, v)
    st = [root]
    until st.empty?
      n = st.pop
      next if n.nil?
      return n if n.val == v
      st << n.left << n.right
    end
    nil
  end

  def self.jin(t, v)
    case t
    when 'ListNode'
      n = list(v)
      n.first
    when 'CycleList'
      vals, pos = v
      n = list(vals)
      n[-1].next = n[pos] if !n.empty? && !pos.nil? && pos >= 0
      n.first
    when 'JoinList'
      vals, k = v
      tail = !k.nil? && k >= 0 ? @ctx[:nodes][k] : nil
      n = list(vals)
      return tail if n.empty?
      n[-1].next = tail
      n.first
    when 'TreeNode'
      @ctx[:tree] = tree(v)
    when 'TreeRef'
      find(@ctx[:tree], v)
    when 'RandomList'
      nodes = v.map { |x, _| Node.new(x) }
      v.each_with_index do |(_, r), i|
        nodes[i].next = nodes[i + 1]
        nodes[i].random = r.nil? ? nil : nodes[r]
      end
      @ctx[:made] = nodes
      nodes.first
    when 'ListNode[]'
      v.map { |x| list(x).first }
    else
      Marshal.load(Marshal.dump(v))
    end
  end

  def self.plain(v)
    case v
    when nil, true, false, Integer, String then v
    when Float then v.finite? ? v : nil
    when ListNode
      out = []
      while !v.nil? && out.length < 100000
        out << v.val
        v = v.next
      end
      out
    when TreeNode
      q = [v]
      out = []
      h = 0
      while h < q.length && q.length < 400000
        t = q[h]
        h += 1
        if t.nil?
          out << nil
        else
          out << t.val
          q << t.left << t.right
        end
      end
      out.pop while !out.empty? && out[-1].nil?
      out
    when Array, Set then v.to_a.map { |x| plain(x) }
    when Symbol then v.to_s
    else v.to_s
    end
  end

  def self.jout(t, v)
    case t
    when 'NodeIndex'
      return nil if v.nil?
      i = @ctx[:nodes].index { |n| n.equal?(v) }
      i.nil? ? '不是输入里的节点' : i
    when 'TreeVal'
      v.nil? ? nil : v.val
    when 'RandomList'
      idx = {}.compare_by_identity
      cur = v
      while !cur.nil? && idx.size < 100000
        idx[cur] = idx.size
        cur = cur.next
      end
      old = {}.compare_by_identity
      @ctx[:made].each { |n| old[n] = true }
      out = []
      cur = v
      while !cur.nil? && out.length < 100000
        return '没有复制：返回了原链表的节点' if old.key?(cur)
        r = cur.random
        out << [cur.val, r.nil? ? nil : idx.fetch(r, '?')]
        cur = cur.next
      end
      out
    else
      plain(v)
    end
  end

  # 跑一个用例，返回要输出的结果
  def self.run_case(sig, c, names)
    reset
    if sig['kind'] == 'design'
      ops, argv = c
      obj = Object.const_get(sig['cls']).new(*sig['ctor'].zip(argv[0]).map { |t, x| jin(t, x) })
      out = [nil]
      ops[1..].zip(argv[1..]).each do |name, a|
        m = sig['methods'][name]
        r = obj.send(names[name], *m['params'].zip(a).map { |t, x| jin(t, x) })
        out << (m['ret'] == 'void' ? nil : jout(m['ret'], r))
      end
      return out
    end
    args = sig['params'].zip(c).map { |t, x| jin(t, x) }
    r = TOPLEVEL_BINDING.receiver.send(names['__fn'], *args)
    sig['ret'] == 'void' ? jout(sig['params'][sig['out']], args[sig['out']]) : jout(sig['ret'], r)
  end
end
