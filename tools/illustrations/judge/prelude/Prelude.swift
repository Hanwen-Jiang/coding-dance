// 判题程序的 Swift 部分（单独一个文件，和用户代码一起编译）：力扣 Swift 环境里现成的两个节点类型、建参数、把结果写成 JSON。
// 结果按静态类型写成 JSON：能输出的类型都实现 JJ（数组、可选值按元素递归）。
public class ListNode {
    public var val: Int
    public var next: ListNode?
    public init() { self.val = 0; self.next = nil }
    public init(_ val: Int) { self.val = val; self.next = nil }
    public init(_ val: Int, _ next: ListNode?) { self.val = val; self.next = next }
}

public class TreeNode {
    public var val: Int
    public var left: TreeNode?
    public var right: TreeNode?
    public init() { self.val = 0; self.left = nil; self.right = nil }
    public init(_ val: Int) { self.val = val; self.left = nil; self.right = nil }
    public init(_ val: Int, _ left: TreeNode?, _ right: TreeNode?) { self.val = val; self.left = left; self.right = right }
}

// 本用例建出的节点：要按「是不是同一个节点」判的题用（见 judge/util.js 里的类型说明）
var jNodes: [ListNode] = []
var jLastTree: TreeNode? = nil

func jReset() { jNodes = []; jLastTree = nil }

func jList(_ v: [Int]) -> ListNode? {
    let dummy = ListNode(0)
    var cur = dummy
    for x in v { let n = ListNode(x); cur.next = n; cur = n; jNodes.append(n) }
    return dummy.next
}

func jCycle(_ v: [Int], _ pos: Int) -> ListNode? {
    let s = jNodes.count
    let head = jList(v)
    if pos >= 0 && !v.isEmpty { jNodes[s + v.count - 1].next = jNodes[s + pos] }
    return head
}

func jJoin(_ v: [Int], _ k: Int) -> ListNode? {
    let tail: ListNode? = k >= 0 ? jNodes[k] : nil
    let s = jNodes.count
    let head = jList(v)
    if v.isEmpty { return tail }
    jNodes[s + v.count - 1].next = tail
    return head
}

func jIndex(_ n: ListNode?) -> String {
    guard let n = n else { return "null" }
    for (i, x) in jNodes.enumerated() where x === n { return String(i) }
    return jQ("不是输入里的节点")
}

func jTree(_ v: [Int?]) -> TreeNode? {
    jLastTree = nil
    guard let first = v.first, let r = first else { return nil }
    let root = TreeNode(r)
    var q = [root]
    var i = 1, h = 0
    while i < v.count && h < q.count {
        let node = q[h]; h += 1
        if let x = v[i] { let c = TreeNode(x); node.left = c; q.append(c) }
        i += 1
        if i < v.count { if let x = v[i] { let c = TreeNode(x); node.right = c; q.append(c) }; i += 1 }
    }
    jLastTree = root
    return root
}

func jFind(_ v: Int) -> TreeNode? {
    var st: [TreeNode] = []
    if let t = jLastTree { st.append(t) }
    while let t = st.popLast() {
        if t.val == v { return t }
        if let l = t.left { st.append(l) }
        if let r = t.right { st.append(r) }
    }
    return nil
}

func jTreeVal(_ n: TreeNode?) -> String { n == nil ? "null" : String(n!.val) }

func jQ(_ s: String) -> String {
    var o = "\""
    for u in s.unicodeScalars {
        switch u {
        case "\"": o += "\\\""
        case "\\": o += "\\\\"
        case "\n": o += "\\n"
        case "\r": o += "\\r"
        case "\t": o += "\\t"
        default:
            if u.value < 0x20 { let h = String(u.value, radix: 16); o += "\\u" + String(repeating: "0", count: 4 - h.count) + h }
            else { o.unicodeScalars.append(u) }
        }
    }
    return o + "\""
}

protocol JJ { func jj() -> String }
extension Int: JJ { func jj() -> String { String(self) } }
extension Int32: JJ { func jj() -> String { String(self) } }
extension Int64: JJ { func jj() -> String { String(self) } }
extension Double: JJ { func jj() -> String { isFinite ? "\(self)" : "null" } }
extension Float: JJ { func jj() -> String { isFinite ? "\(Double(self))" : "null" } }
extension Bool: JJ { func jj() -> String { self ? "true" : "false" } }
extension String: JJ { func jj() -> String { jQ(self) } }
extension Character: JJ { func jj() -> String { jQ(String(self)) } }
extension Substring: JJ { func jj() -> String { jQ(String(self)) } }
extension Array: JJ where Element: JJ { func jj() -> String { "[" + map { $0.jj() }.joined(separator: ",") + "]" } }
extension ArraySlice: JJ where Element: JJ { func jj() -> String { "[" + map { $0.jj() }.joined(separator: ",") + "]" } }
extension Optional: JJ where Wrapped: JJ { func jj() -> String { switch self { case .none: return "null"; case .some(let x): return x.jj() } } }
extension ListNode: JJ {
    func jj() -> String {
        var out: [String] = []
        var p: ListNode? = self
        while let x = p, out.count < 100000 { out.append(String(x.val)); p = x.next }
        return "[" + out.joined(separator: ",") + "]"
    }
}
extension TreeNode: JJ {
    func jj() -> String {
        var q: [TreeNode?] = [self]
        var vals: [String] = []
        var h = 0
        while h < q.count && q.count < 400000 {
            let t = q[h]; h += 1
            if let t = t { vals.append(String(t.val)); q.append(t.left); q.append(t.right) } else { vals.append("null") }
        }
        while vals.last == "null" { vals.removeLast() }
        return "[" + vals.joined(separator: ",") + "]"
    }
}
func jOut<T: JJ>(_ x: T) -> String { x.jj() }
