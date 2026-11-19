// 判题程序的 Kotlin 部分（单独一个文件，和用户代码一起编译）：力扣 Kotlin 环境里现成的两个节点类型、建参数、把结果写成 JSON
class ListNode(var `val`: Int = 0) {
    var next: ListNode? = null
}

class TreeNode(var `val`: Int = 0) {
    var left: TreeNode? = null
    var right: TreeNode? = null
}

object JH {
    // 本用例建出的节点：要按「是不是同一个节点」判的题用（见 judge/util.js 里的类型说明）
    val nodes = ArrayList<ListNode>()
    var lastTree: TreeNode? = null

    fun reset() { nodes.clear(); lastTree = null }

    fun list(v: IntArray): ListNode? {
        val dummy = ListNode(0)
        var cur = dummy
        for (x in v) { val n = ListNode(x); cur.next = n; cur = n; nodes.add(n) }
        return dummy.next
    }

    fun cycle(v: IntArray, pos: Int): ListNode? {
        val s = nodes.size
        val head = list(v)
        if (pos >= 0 && v.isNotEmpty()) nodes[s + v.size - 1].next = nodes[s + pos]
        return head
    }

    fun join(v: IntArray, k: Int): ListNode? {
        val tail = if (k >= 0) nodes[k] else null
        val s = nodes.size
        val head = list(v)
        if (v.isEmpty()) return tail
        nodes[s + v.size - 1].next = tail
        return head
    }

    fun index(n: ListNode?): Any? {
        if (n == null) return null
        for (i in nodes.indices) if (nodes[i] === n) return i
        return "不是输入里的节点"
    }

    fun tree(v: Array<Int?>): TreeNode? {
        lastTree = null
        if (v.isEmpty() || v[0] == null) return null
        val root = TreeNode(v[0]!!)
        val q = arrayListOf(root)
        var i = 1
        var h = 0
        while (i < v.size && h < q.size) {
            val node = q[h++]
            v[i]?.let { val c = TreeNode(it); node.left = c; q.add(c) }
            i++
            if (i < v.size) { v[i]?.let { val c = TreeNode(it); node.right = c; q.add(c) }; i++ }
        }
        lastTree = root
        return root
    }

    fun find(v: Int): TreeNode? {
        val st = ArrayDeque<TreeNode>()
        lastTree?.let { st.addLast(it) }
        while (st.isNotEmpty()) {
            val t = st.removeLast()
            if (t.`val` == v) return t
            t.left?.let { st.addLast(it) }
            t.right?.let { st.addLast(it) }
        }
        return null
    }

    fun treeVal(n: TreeNode?): Any? = n?.`val`

    fun json(o: Any?): String { val sb = StringBuilder(); w(sb, o); return sb.toString() }

    fun q(s: String): String { val sb = StringBuilder(); q(sb, s); return sb.toString() }

    private fun q(sb: StringBuilder, s: String) {
        sb.append('"')
        for (c in s) {
            when {
                c == '"' || c == '\\' -> sb.append('\\').append(c)
                c == '\n' -> sb.append("\\n")
                c == '\r' -> sb.append("\\r")
                c == '\t' -> sb.append("\\t")
                c < ' ' -> sb.append(String.format("\\u%04x", c.code))
                else -> sb.append(c)
            }
        }
        sb.append('"')
    }

    private fun num(sb: StringBuilder, d: Double) { if (d.isNaN() || d.isInfinite()) sb.append("null") else sb.append(d.toString()) }

    private fun seq(sb: StringBuilder, items: Iterator<Any?>) {
        sb.append('[')
        var first = true
        for (x in items) { if (!first) sb.append(','); first = false; w(sb, x) }
        sb.append(']')
    }

    private fun w(sb: StringBuilder, o: Any?) {
        when (o) {
            null -> sb.append("null")
            is Boolean, is Int, is Long, is Short, is Byte -> sb.append(o.toString())
            is Double -> num(sb, o)
            is Float -> num(sb, o.toDouble())
            is String -> q(sb, o)
            is Char -> q(sb, o.toString())
            is ListNode -> {
                sb.append('[')
                var p: ListNode? = o
                var n = 0
                while (p != null && n < 100000) { if (n > 0) sb.append(','); sb.append(p.`val`); p = p.next; n++ }
                sb.append(']')
            }
            is TreeNode -> {
                val q = arrayListOf<TreeNode?>(o)
                val vals = ArrayList<Int?>()
                var h = 0
                while (h < q.size && q.size < 400000) {
                    val t = q[h++]
                    if (t == null) { vals.add(null); continue }
                    vals.add(t.`val`); q.add(t.left); q.add(t.right)
                }
                while (vals.isNotEmpty() && vals.last() == null) vals.removeAt(vals.size - 1)
                seq(sb, vals.iterator())
            }
            is IntArray -> seq(sb, o.iterator())
            is LongArray -> seq(sb, o.iterator())
            is DoubleArray -> seq(sb, o.iterator())
            is BooleanArray -> seq(sb, o.iterator())
            is CharArray -> seq(sb, o.iterator())
            is Array<*> -> seq(sb, o.iterator())
            is Iterable<*> -> seq(sb, o.iterator())
            is Sequence<*> -> seq(sb, o.iterator())
            else -> q(sb, o.toString())
        }
    }
}
