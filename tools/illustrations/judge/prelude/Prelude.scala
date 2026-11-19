// 判题程序的 Scala 部分（单独一个文件，和用户代码一起编译）：力扣 Scala 环境里现成的两个节点类型、建参数、把结果写成 JSON
class ListNode(_x: Int = 0, _next: ListNode = null) {
  var next: ListNode = _next
  var x: Int = _x
}

class TreeNode(_value: Int = 0, _left: TreeNode = null, _right: TreeNode = null) {
  var value: Int = _value
  var left: TreeNode = _left
  var right: TreeNode = _right
}

object JH {
  // 本用例建出的节点：要按「是不是同一个节点」判的题用（见 judge/util.js 里的类型说明）
  val nodes = new java.util.ArrayList[ListNode]()
  var lastTree: TreeNode = null

  def reset(): Unit = { nodes.clear(); lastTree = null }

  def list(v: Array[Int]): ListNode = {
    val dummy = new ListNode()
    var cur = dummy
    for (x <- v) { val n = new ListNode(x); cur.next = n; cur = n; nodes.add(n) }
    dummy.next
  }

  def cycle(v: Array[Int], pos: Int): ListNode = {
    val s = nodes.size
    val head = list(v)
    if (pos >= 0 && v.nonEmpty) nodes.get(s + v.length - 1).next = nodes.get(s + pos)
    head
  }

  def join(v: Array[Int], k: Int): ListNode = {
    val tail = if (k >= 0) nodes.get(k) else null
    val s = nodes.size
    val head = list(v)
    if (v.isEmpty) tail
    else { nodes.get(s + v.length - 1).next = tail; head }
  }

  def index(n: ListNode): Any = {
    if (n == null) return null
    var i = 0
    while (i < nodes.size) { if (nodes.get(i) eq n) return i; i += 1 }
    "不是输入里的节点"
  }

  def tree(v: Array[Option[Int]]): TreeNode = {
    lastTree = null
    if (v.isEmpty || v(0).isEmpty) return null
    val root = new TreeNode(v(0).get)
    val q = scala.collection.mutable.ArrayBuffer(root)
    var i = 1
    var h = 0
    while (i < v.length && h < q.length) {
      val node = q(h); h += 1
      v(i).foreach { x => node.left = new TreeNode(x); q += node.left }
      i += 1
      if (i < v.length) { v(i).foreach { x => node.right = new TreeNode(x); q += node.right }; i += 1 }
    }
    lastTree = root
    root
  }

  def find(v: Int): TreeNode = {
    val st = scala.collection.mutable.Stack[TreeNode]()
    if (lastTree != null) st.push(lastTree)
    while (st.nonEmpty) {
      val t = st.pop()
      if (t.value == v) return t
      if (t.left != null) st.push(t.left)
      if (t.right != null) st.push(t.right)
    }
    null
  }

  def treeVal(n: TreeNode): Any = if (n == null) null else n.value

  def json(o: Any): String = { val sb = new StringBuilder; w(sb, o); sb.toString }

  def q(s: String): String = { val sb = new StringBuilder; q(sb, s); sb.toString }

  private def q(sb: StringBuilder, s: String): Unit = {
    sb.append('"')
    for (c <- s) {
      if (c == '"' || c == '\\') sb.append('\\').append(c)
      else if (c == '\n') sb.append("\\n")
      else if (c == '\r') sb.append("\\r")
      else if (c == '\t') sb.append("\\t")
      else if (c < ' ') sb.append("\\u%04x".format(c.toInt))
      else sb.append(c)
    }
    sb.append('"')
  }

  private def seq(sb: StringBuilder, it: Iterator[Any]): Unit = {
    sb.append('[')
    var first = true
    for (x <- it) { if (!first) sb.append(','); first = false; w(sb, x) }
    sb.append(']')
  }

  private def w(sb: StringBuilder, o: Any): Unit = o match {
    case null => sb.append("null")
    case b: Boolean => sb.append(b)
    case i: Int => sb.append(i)
    case l: Long => sb.append(l)
    case s: Short => sb.append(s)
    case b: Byte => sb.append(b)
    case d: Double => sb.append(if (d.isNaN || d.isInfinite) "null" else d.toString)
    case f: Float => sb.append(if (f.isNaN || f.isInfinite) "null" else f.toDouble.toString)
    case s: String => q(sb, s)
    case c: Char => q(sb, c.toString)
    case l: ListNode =>
      sb.append('[')
      var p = l
      var n = 0
      while (p != null && n < 100000) { if (n > 0) sb.append(','); sb.append(p.x); p = p.next; n += 1 }
      sb.append(']')
    case t: TreeNode =>
      val q = scala.collection.mutable.ArrayBuffer[TreeNode](t)
      val vals = scala.collection.mutable.ArrayBuffer[Any]()
      var h = 0
      while (h < q.length && q.length < 400000) {
        val x = q(h); h += 1
        if (x == null) vals += null else { vals += x.value; q += x.left; q += x.right }
      }
      while (vals.nonEmpty && vals.last == null) vals.remove(vals.length - 1)
      seq(sb, vals.iterator)
    case a: Array[_] => seq(sb, a.iterator)
    case it: IterableOnce[_] => seq(sb, it.iterator)
    case it: java.lang.Iterable[_] => seq(sb, scala.jdk.CollectionConverters.IteratorHasAsScala(it.iterator).asScala)
    case Some(x) => w(sb, x)
    case None => sb.append("null")
    case other => q(sb, other.toString)
  }
}
