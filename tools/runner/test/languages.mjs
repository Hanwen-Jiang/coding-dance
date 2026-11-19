// 后加的九种语言（C、C#、Kotlin、Swift、Rust、Ruby、PHP、Scala、Dart）的测试代码：没有官方题解，这里手写几题，
// 再给 sandbox.test.mjs 的「崩溃 / 超时 / 输出」「ACM」「编译报错行号」三项各写一份。
//   SOLUTIONS[lang][题号]：力扣模式的题解（数组、链表、成环、树、嵌套列表、设计类、原地修改、按节点判）
//   BAD[lang]：两数之和，nums[0] == 99 时崩溃（第 2–4 行），== 98 时死循环，否则打印「看看 n」再给出正确答案
//   ACM[lang]：读两个数输出和；BROKEN[lang]：第 3 行编译不过

export const SOLUTIONS = {
  c: {
    1: `int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    for (int i = 0; i < numsSize; i++)
        for (int j = i + 1; j < numsSize; j++)
            if (nums[i] + nums[j] == target) {
                int* r = malloc(sizeof(int) * 2);
                r[0] = i; r[1] = j; *returnSize = 2;
                return r;
            }
    *returnSize = 0;
    return NULL;
}`,
    206: `struct ListNode* reverseList(struct ListNode* head) {
    struct ListNode* prev = NULL;
    while (head) { struct ListNode* next = head->next; head->next = prev; prev = head; head = next; }
    return prev;
}`,
    102: `int** levelOrder(struct TreeNode* root, int* returnSize, int** returnColumnSizes) {
    struct TreeNode* q[2001];
    int head = 0, tail = 0;
    int** res = malloc(sizeof(int*) * 2000);
    *returnColumnSizes = malloc(sizeof(int) * 2000);
    *returnSize = 0;
    if (root) q[tail++] = root;
    while (head < tail) {
        int n = tail - head;
        res[*returnSize] = malloc(sizeof(int) * n);
        (*returnColumnSizes)[*returnSize] = n;
        for (int i = 0; i < n; i++) {
            struct TreeNode* t = q[head++];
            res[*returnSize][i] = t->val;
            if (t->left) q[tail++] = t->left;
            if (t->right) q[tail++] = t->right;
        }
        (*returnSize)++;
    }
    return res;
}`,
    155: `typedef struct {
    int* a;
    int* m;
    int n;
} MinStack;

MinStack* minStackCreate() {
    MinStack* s = malloc(sizeof(MinStack));
    s->a = malloc(sizeof(int) * 30000);
    s->m = malloc(sizeof(int) * 30000);
    s->n = 0;
    return s;
}

void minStackPush(MinStack* obj, int val) {
    obj->a[obj->n] = val;
    obj->m[obj->n] = obj->n && obj->m[obj->n - 1] < val ? obj->m[obj->n - 1] : val;
    obj->n++;
}

void minStackPop(MinStack* obj) { obj->n--; }

int minStackTop(MinStack* obj) { return obj->a[obj->n - 1]; }

int minStackGetMin(MinStack* obj) { return obj->m[obj->n - 1]; }

void minStackFree(MinStack* obj) { free(obj->a); free(obj->m); free(obj); }`,
    283: `void moveZeroes(int* nums, int numsSize) {
    int k = 0;
    for (int i = 0; i < numsSize; i++) if (nums[i]) nums[k++] = nums[i];
    while (k < numsSize) nums[k++] = 0;
}`,
    141: `bool hasCycle(struct ListNode *head) {
    struct ListNode *slow = head, *fast = head;
    while (fast && fast->next) {
        slow = slow->next;
        fast = fast->next->next;
        if (slow == fast) return true;
    }
    return false;
}`,
    49: `static int cmpChar(const void* a, const void* b) { return *(const char*)a - *(const char*)b; }

char*** groupAnagrams(char** strs, int strsSize, int* returnSize, int** returnColumnSizes) {
    char** keys = malloc(sizeof(char*) * (strsSize + 1));
    int* group = malloc(sizeof(int) * (strsSize + 1));
    int groups = 0;
    for (int i = 0; i < strsSize; i++) {
        char* k = strdup(strs[i]);
        qsort(k, strlen(k), 1, cmpChar);
        int g = 0;
        while (g < groups && strcmp(keys[g], k) != 0) g++;
        if (g == groups) keys[groups++] = k; else free(k);
        group[i] = g;
    }
    char*** res = malloc(sizeof(char**) * (groups + 1));
    *returnColumnSizes = calloc(groups + 1, sizeof(int));
    for (int g = 0; g < groups; g++) res[g] = malloc(sizeof(char*) * strsSize);
    for (int i = 0; i < strsSize; i++) { int g = group[i]; res[g][(*returnColumnSizes)[g]++] = strs[i]; }
    *returnSize = groups;
    return res;
}`,
  },
  csharp: {
    1: `public class Solution {
    public int[] TwoSum(int[] nums, int target) {
        var seen = new Dictionary<int, int>();
        for (int i = 0; i < nums.Length; i++) {
            if (seen.TryGetValue(target - nums[i], out var j)) return new[] { j, i };
            seen[nums[i]] = i;
        }
        return Array.Empty<int>();
    }
}`,
    206: `public class Solution {
    public ListNode ReverseList(ListNode head) {
        ListNode prev = null;
        while (head != null) { var next = head.next; head.next = prev; prev = head; head = next; }
        return prev;
    }
}`,
    102: `public class Solution {
    public IList<IList<int>> LevelOrder(TreeNode root) {
        var res = new List<IList<int>>();
        var q = new Queue<TreeNode>();
        if (root != null) q.Enqueue(root);
        while (q.Count > 0) {
            var level = new List<int>();
            for (int n = q.Count; n > 0; n--) {
                var t = q.Dequeue();
                level.Add(t.val);
                if (t.left != null) q.Enqueue(t.left);
                if (t.right != null) q.Enqueue(t.right);
            }
            res.Add(level);
        }
        return res;
    }
}`,
    155: `public class MinStack {
    private readonly Stack<(int v, int m)> st = new();

    public MinStack() {}

    public void Push(int val) => st.Push((val, st.Count == 0 ? val : Math.Min(val, st.Peek().m)));

    public void Pop() => st.Pop();

    public int Top() => st.Peek().v;

    public int GetMin() => st.Peek().m;
}`,
    283: `public class Solution {
    public void MoveZeroes(int[] nums) {
        int k = 0;
        foreach (var x in nums) if (x != 0) nums[k++] = x;
        while (k < nums.Length) nums[k++] = 0;
    }
}`,
    141: `public class Solution {
    public bool HasCycle(ListNode head) {
        var seen = new HashSet<ListNode>();
        for (var p = head; p != null; p = p.next) if (!seen.Add(p)) return true;
        return false;
    }
}`,
  },
  kotlin: {
    1: `class Solution {
    fun twoSum(nums: IntArray, target: Int): IntArray {
        val seen = HashMap<Int, Int>()
        for ((i, x) in nums.withIndex()) {
            seen[target - x]?.let { return intArrayOf(it, i) }
            seen[x] = i
        }
        return intArrayOf()
    }
}`,
    206: `class Solution {
    fun reverseList(head: ListNode?): ListNode? {
        var prev: ListNode? = null
        var cur = head
        while (cur != null) { val next = cur.next; cur.next = prev; prev = cur; cur = next }
        return prev
    }
}`,
    102: `class Solution {
    fun levelOrder(root: TreeNode?): List<List<Int>> {
        val res = mutableListOf<List<Int>>()
        var level = listOfNotNull(root)
        while (level.isNotEmpty()) {
            res.add(level.map { it.\`val\` })
            level = level.flatMap { listOfNotNull(it.left, it.right) }
        }
        return res
    }
}`,
    155: `class MinStack() {
    private val st = ArrayDeque<Pair<Int, Int>>()

    fun push(value: Int) {
        st.addLast(value to minOf(value, st.lastOrNull()?.second ?: value))
    }

    fun pop() {
        st.removeLast()
    }

    fun top(): Int = st.last().first

    fun getMin(): Int = st.last().second
}`,
    283: `class Solution {
    fun moveZeroes(nums: IntArray): Unit {
        var k = 0
        for (x in nums) if (x != 0) nums[k++] = x
        while (k < nums.size) nums[k++] = 0
    }
}`,
    141: `class Solution {
    fun hasCycle(head: ListNode?): Boolean {
        var slow = head
        var fast = head
        while (fast?.next != null) {
            slow = slow?.next
            fast = fast.next?.next
            if (slow === fast) return true
        }
        return false
    }
}`,
  },
  scala: {
    1: `object Solution {
    def twoSum(nums: Array[Int], target: Int): Array[Int] = {
        val seen = scala.collection.mutable.HashMap[Int, Int]()
        for (i <- nums.indices) {
            seen.get(target - nums(i)) match {
                case Some(j) => return Array(j, i)
                case None => seen(nums(i)) = i
            }
        }
        Array()
    }
}`,
    206: `object Solution {
    def reverseList(head: ListNode): ListNode = {
        var prev: ListNode = null
        var cur = head
        while (cur != null) { val next = cur.next; cur.next = prev; prev = cur; cur = next }
        prev
    }
}`,
    102: `object Solution {
    def levelOrder(root: TreeNode): List[List[Int]] = {
        val res = scala.collection.mutable.ListBuffer[List[Int]]()
        var level = if (root == null) List[TreeNode]() else List(root)
        while (level.nonEmpty) {
            res += level.map(_.value)
            level = level.flatMap(t => List(t.left, t.right).filter(_ != null))
        }
        res.toList
    }
}`,
    155: `class MinStack() {
    private val st = scala.collection.mutable.Stack[(Int, Int)]()

    def push(value: Int): Unit = {
        st.push((value, if (st.isEmpty) value else math.min(value, st.top._2)))
    }

    def pop(): Unit = {
        st.pop()
    }

    def top(): Int = {
        st.top._1
    }

    def getMin(): Int = {
        st.top._2
    }
}`,
    283: `object Solution {
    def moveZeroes(nums: Array[Int]): Unit = {
        var k = 0
        for (x <- nums if x != 0) { nums(k) = x; k += 1 }
        while (k < nums.length) { nums(k) = 0; k += 1 }
    }
}`,
    141: `object Solution {
    def hasCycle(head: ListNode): Boolean = {
        var slow = head
        var fast = head
        while (fast != null && fast.next != null) {
            slow = slow.next
            fast = fast.next.next
            if (slow eq fast) return true
        }
        false
    }
}`,
  },
  swift: {
    1: `class Solution {
    func twoSum(_ nums: [Int], _ target: Int) -> [Int] {
        var seen = [Int: Int]()
        for (i, x) in nums.enumerated() {
            if let j = seen[target - x] { return [j, i] }
            seen[x] = i
        }
        return []
    }
}`,
    206: `class Solution {
    func reverseList(_ head: ListNode?) -> ListNode? {
        var prev: ListNode? = nil, cur = head
        while let c = cur { let next = c.next; c.next = prev; prev = c; cur = next }
        return prev
    }
}`,
    102: `class Solution {
    func levelOrder(_ root: TreeNode?) -> [[Int]] {
        var res: [[Int]] = []
        var level = [root].compactMap { $0 }
        while !level.isEmpty {
            res.append(level.map { $0.val })
            level = level.flatMap { [$0.left, $0.right].compactMap { $0 } }
        }
        return res
    }
}`,
    155: `
class MinStack {
    private var st: [(Int, Int)] = []

    init() {

    }

    func push(_ val: Int) {
        st.append((val, min(val, st.last?.1 ?? val)))
    }

    func pop() {
        st.removeLast()
    }

    func top() -> Int {
        return st.last!.0
    }

    func getMin() -> Int {
        return st.last!.1
    }
}`,
    283: `class Solution {
    func moveZeroes(_ nums: inout [Int]) {
        var k = 0
        for x in nums where x != 0 { nums[k] = x; k += 1 }
        while k < nums.count { nums[k] = 0; k += 1 }
    }
}`,
    141: `class Solution {
    func hasCycle(_ head: ListNode?) -> Bool {
        var slow = head, fast = head
        while fast != nil && fast?.next != nil {
            slow = slow?.next
            fast = fast?.next?.next
            if slow === fast { return true }
        }
        return false
    }
}`,
  },
  rust: {
    1: `impl Solution {
    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {
        let mut seen = std::collections::HashMap::new();
        for (i, &x) in nums.iter().enumerate() {
            if let Some(&j) = seen.get(&(target - x)) { return vec![j as i32, i as i32]; }
            seen.insert(x, i);
        }
        vec![]
    }
}`,
    206: `impl Solution {
    pub fn reverse_list(head: Option<Box<ListNode>>) -> Option<Box<ListNode>> {
        let (mut prev, mut cur) = (None, head);
        while let Some(mut node) = cur {
            cur = node.next.take();
            node.next = prev;
            prev = Some(node);
        }
        prev
    }
}`,
    102: `use std::rc::Rc;
use std::cell::RefCell;
impl Solution {
    pub fn level_order(root: Option<Rc<RefCell<TreeNode>>>) -> Vec<Vec<i32>> {
        let mut res = vec![];
        let mut level: Vec<Rc<RefCell<TreeNode>>> = root.into_iter().collect();
        while !level.is_empty() {
            res.push(level.iter().map(|t| t.borrow().val).collect());
            level = level.iter().flat_map(|t| { let b = t.borrow(); vec![b.left.clone(), b.right.clone()] }).flatten().collect();
        }
        res
    }
}`,
    155: `struct MinStack {
    st: Vec<(i32, i32)>,
}

impl MinStack {

    fn new() -> Self {
        MinStack { st: vec![] }
    }

    fn push(&mut self, val: i32) {
        let m = self.st.last().map_or(val, |&(_, m)| m.min(val));
        self.st.push((val, m));
    }

    fn pop(&mut self) {
        self.st.pop();
    }

    fn top(&self) -> i32 {
        self.st.last().unwrap().0
    }

    fn get_min(&self) -> i32 {
        self.st.last().unwrap().1
    }
}`,
    283: `impl Solution {
    pub fn move_zeroes(nums: &mut Vec<i32>) {
        let mut k = 0;
        for i in 0..nums.len() { if nums[i] != 0 { nums.swap(i, k); k += 1; } }
    }
}`,
    236: `use std::rc::Rc;
use std::cell::RefCell;
impl Solution {
    pub fn lowest_common_ancestor(root: Option<Rc<RefCell<TreeNode>>>, p: Option<Rc<RefCell<TreeNode>>>, q: Option<Rc<RefCell<TreeNode>>>) -> Option<Rc<RefCell<TreeNode>>> {
        let node = root?;
        if p.as_ref().map_or(false, |x| Rc::ptr_eq(x, &node)) || q.as_ref().map_or(false, |x| Rc::ptr_eq(x, &node)) { return Some(node); }
        let left = Self::lowest_common_ancestor(node.borrow().left.clone(), p.clone(), q.clone());
        let right = Self::lowest_common_ancestor(node.borrow().right.clone(), p, q);
        match (&left, &right) { (Some(_), Some(_)) => Some(node), (Some(_), None) => left, _ => right }
    }
}`,
  },
  ruby: {
    1: `def two_sum(nums, target)
  seen = {}
  nums.each_with_index do |x, i|
    return [seen[target - x], i] if seen.key?(target - x)
    seen[x] = i
  end
  []
end`,
    206: `def reverse_list(head)
  prev = nil
  while head
    nxt = head.next
    head.next = prev
    prev = head
    head = nxt
  end
  prev
end`,
    102: `def level_order(root)
  res = []
  level = [root].compact
  until level.empty?
    res << level.map(&:val)
    level = level.flat_map { |t| [t.left, t.right].compact }
  end
  res
end`,
    155: `class MinStack
  def initialize()
    @st = []
  end

  def push(val)
    @st << [val, @st.empty? ? val : [val, @st[-1][1]].min]
  end

  def pop()
    @st.pop
  end

  def top()
    @st[-1][0]
  end

  def get_min()
    @st[-1][1]
  end
end`,
    283: `def move_zeroes(nums)
  k = 0
  nums.each { |x| if x != 0 then nums[k] = x; k += 1 end }
  (k...nums.length).each { |i| nums[i] = 0 }
  nil
end`,
    141: `def hasCycle(head)
  slow = fast = head
  while fast && fast.next
    slow = slow.next
    fast = fast.next.next
    return true if slow.equal?(fast)
  end
  false
end`,
  },
  php: {
    1: `class Solution {
    function twoSum($nums, $target) {
        $seen = [];
        foreach ($nums as $i => $x) {
            if (isset($seen[$target - $x])) return [$seen[$target - $x], $i];
            $seen[$x] = $i;
        }
        return [];
    }
}`,
    206: `class Solution {
    function reverseList($head) {
        $prev = null;
        while ($head !== null) { $next = $head->next; $head->next = $prev; $prev = $head; $head = $next; }
        return $prev;
    }
}`,
    102: `class Solution {
    function levelOrder($root) {
        $res = [];
        $level = $root ? [$root] : [];
        while ($level) {
            $res[] = array_map(fn($t) => $t->val, $level);
            $next = [];
            foreach ($level as $t) { if ($t->left) $next[] = $t->left; if ($t->right) $next[] = $t->right; }
            $level = $next;
        }
        return $res;
    }
}`,
    155: `class MinStack {
    private $st = [];

    function __construct() {}

    function push($val) {
        $this->st[] = [$val, $this->st ? min($val, end($this->st)[1]) : $val];
    }

    function pop() {
        array_pop($this->st);
    }

    function top() {
        return end($this->st)[0];
    }

    function getMin() {
        return end($this->st)[1];
    }
}`,
    283: `class Solution {
    function moveZeroes(&$nums) {
        $k = 0;
        foreach ($nums as $x) if ($x != 0) $nums[$k++] = $x;
        for (; $k < count($nums); $k++) $nums[$k] = 0;
    }
}`,
    141: `class Solution {
    function hasCycle($head) {
        $slow = $fast = $head;
        while ($fast !== null && $fast->next !== null) {
            $slow = $slow->next;
            $fast = $fast->next->next;
            if ($slow === $fast) return true;
        }
        return false;
    }
}`,
  },
  dart: {
    1: `class Solution {
  List<int> twoSum(List<int> nums, int target) {
    final seen = <int, int>{};
    for (var i = 0; i < nums.length; i++) {
      final j = seen[target - nums[i]];
      if (j != null) return [j, i];
      seen[nums[i]] = i;
    }
    return [];
  }
}`,
    206: `class Solution {
  ListNode? reverseList(ListNode? head) {
    ListNode? prev;
    while (head != null) {
      final next = head.next;
      head.next = prev;
      prev = head;
      head = next;
    }
    return prev;
  }
}`,
    102: `class Solution {
  List<List<int>> levelOrder(TreeNode? root) {
    final res = <List<int>>[];
    var level = <TreeNode>[if (root != null) root];
    while (level.isNotEmpty) {
      res.add([for (final t in level) t.val]);
      level = [for (final t in level) ...[t.left, t.right].whereType<TreeNode>()];
    }
    return res;
  }
}`,
    155: `class MinStack {
  final _st = <List<int>>[];

  MinStack() {}

  void push(int val) {
    _st.add([val, _st.isEmpty ? val : min(val, _st.last[1])]);
  }

  void pop() {
    _st.removeLast();
  }

  int top() {
    return _st.last[0];
  }

  int getMin() {
    return _st.last[1];
  }
}`,
    283: `class Solution {
  void moveZeroes(List<int> nums) {
    var k = 0;
    for (final x in nums.toList()) {
      if (x != 0) nums[k++] = x;
    }
    while (k < nums.length) {
      nums[k++] = 0;
    }
  }
}`,
    141: `class Solution {
  bool hasCycle(ListNode? head) {
    var slow = head, fast = head;
    while (fast != null && fast.next != null) {
      slow = slow!.next;
      fast = fast.next!.next;
      if (identical(slow, fast)) return true;
    }
    return false;
  }
}`,
  },
};

export const BAD = {
  c: `int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    if (nums[0] == 99) { int* p = NULL; *returnSize = 1; p[0] = 1; return p; }
    while (nums[0] == 98) {}
    printf("看看 %d\\n", numsSize);
    for (int i = 0; i < numsSize; i++)
        for (int j = i + 1; j < numsSize; j++)
            if (nums[i] + nums[j] == target) { int* r = malloc(sizeof(int) * 2); r[0] = i; r[1] = j; *returnSize = 2; return r; }
    *returnSize = 0;
    return NULL;
}`,
  csharp: `public class Solution {
    public int[] TwoSum(int[] nums, int target) {
        if (nums[0] == 99) { int[] a = new int[1]; return new int[]{a[5]}; }
        while (nums[0] == 98) {}
        Console.WriteLine("看看 " + nums.Length);
        var seen = new Dictionary<int, int>();
        for (int i = 0; i < nums.Length; i++) {
            if (seen.ContainsKey(target - nums[i])) return new int[]{seen[target - nums[i]], i};
            seen[nums[i]] = i;
        }
        return new int[0];
    }
}`,
  kotlin: `class Solution {
    fun twoSum(nums: IntArray, target: Int): IntArray {
        if (nums[0] == 99) { val a = IntArray(1); return intArrayOf(a[5]) }
        while (nums[0] == 98) {}
        println("看看 " + nums.size)
        val seen = HashMap<Int, Int>()
        for (i in nums.indices) {
            seen[target - nums[i]]?.let { return intArrayOf(it, i) }
            seen[nums[i]] = i
        }
        return IntArray(0)
    }
}`,
  scala: `object Solution {
    def twoSum(nums: Array[Int], target: Int): Array[Int] = {
        if (nums(0) == 99) { val a = new Array[Int](1); return Array(a(5)) }
        while (nums(0) == 98) {}
        println("看看 " + nums.length)
        val seen = scala.collection.mutable.HashMap[Int, Int]()
        for (i <- nums.indices) {
            if (seen.contains(target - nums(i))) return Array(seen(target - nums(i)), i)
            seen(nums(i)) = i
        }
        Array()
    }
}`,
  swift: `class Solution {
    func twoSum(_ nums: [Int], _ target: Int) -> [Int] {
        if nums[0] == 99 { let a = [0]; return [a[nums.count + 4]] }
        // 开了优化时空循环会被删掉，循环里做点事
        while nums[0] == 98 { usleep(1) }
        print("看看", nums.count)
        var seen = [Int: Int]()
        for (i, x) in nums.enumerated() {
            if let j = seen[target - x] { return [j, i] }
            seen[x] = i
        }
        return []
    }
}`,
  rust: `impl Solution {
    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {
        if nums[0] == 99 { let a = vec![0]; return vec![a[nums.len() + 4]]; }
        while nums[0] == 98 {}
        println!("看看 {}", nums.len());
        let mut seen = std::collections::HashMap::new();
        for (i, &x) in nums.iter().enumerate() {
            if let Some(&j) = seen.get(&(target - x)) { return vec![j as i32, i as i32]; }
            seen.insert(x, i);
        }
        vec![]
    }
}`,
  ruby: `def two_sum(nums, target)
  return [[0][5].abs] if nums[0] == 99
  while nums[0] == 98 do end
  puts "看看 #{nums.length}"
  seen = {}
  nums.each_with_index do |x, i|
    return [seen[target - x], i] if seen.key?(target - x)
    seen[x] = i
  end
  []
end`,
  php: `class Solution {
    function twoSum($nums, $target) {
        if ($nums[0] == 99) { $a = null; return $a->x(); }
        while ($nums[0] == 98) {}
        echo "看看 " . count($nums) . "\\n";
        $seen = [];
        foreach ($nums as $i => $x) {
            if (isset($seen[$target - $x])) return [$seen[$target - $x], $i];
            $seen[$x] = $i;
        }
        return [];
    }
}`,
  dart: `class Solution {
  List<int> twoSum(List<int> nums, int target) {
    if (nums[0] == 99) { final a = [0]; return [a[5]]; }
    while (nums[0] == 98) {}
    print("看看 " + nums.length.toString());
    final seen = <int, int>{};
    for (var i = 0; i < nums.length; i++) {
      final j = seen[target - nums[i]];
      if (j != null) return [j, i];
      seen[nums[i]] = i;
    }
    return [];
  }
}`,
};

export const ACM = {
  c: "#include <stdio.h>\n\nint main(void) {\n    long long a, b;\n    if (scanf(\"%lld %lld\", &a, &b) != 2) return 1;\n    printf(\"%lld\\n\", a + b);\n    return 0;\n}\n",
  csharp: "using System;\n\npublic class Program {\n    public static void Main() {\n        var p = Console.ReadLine().Trim().Split(' ');\n        Console.WriteLine(long.Parse(p[0]) + long.Parse(p[1]));\n    }\n}\n",
  kotlin: "fun main() {\n    val (a, b) = readLine()!!.trim().split(\" \").map { it.toLong() }\n    println(a + b)\n}\n",
  scala: "object Main {\n    def main(args: Array[String]): Unit = {\n        val Array(a, b) = scala.io.StdIn.readLine().trim.split(\" \").map(_.toLong)\n        println(a + b)\n    }\n}\n",
  swift: "let p = readLine()!.split(separator: \" \").map { Int($0)! }\nprint(p[0] + p[1])\n",
  rust: "use std::io::Read;\n\nfn main() {\n    let mut s = String::new();\n    std::io::stdin().read_to_string(&mut s).unwrap();\n    let v: Vec<i64> = s.split_whitespace().map(|x| x.parse().unwrap()).collect();\n    println!(\"{}\", v[0] + v[1]);\n}\n",
  ruby: "a, b = gets.split.map(&:to_i)\nputs a + b\n",
  php: "<?php\n[$a, $b] = array_map('intval', explode(' ', trim(fgets(STDIN))));\necho $a + $b, \"\\n\";\n",
  dart: "import 'dart:io';\n\nvoid main() {\n  final p = stdin.readLineSync()!.trim().split(' ').map(int.parse).toList();\n  print(p[0] + p[1]);\n}\n",
};

export const BROKEN = {
  c: "int* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n    int x = 1;\n    return y;\n}\n",
  csharp: "public class Solution {\n    public int[] TwoSum(int[] nums, int target) {\n        int x = 1\n        return new int[]{0, 1};\n    }\n}\n",
  kotlin: "class Solution {\n    fun twoSum(nums: IntArray, target: Int): IntArray {\n        return intArrayOf(0, y)\n    }\n}\n",
  scala: "object Solution {\n    def twoSum(nums: Array[Int], target: Int): Array[Int] = {\n        Array(0, y)\n    }\n}\n",
  swift: "class Solution {\n    func twoSum(_ nums: [Int], _ target: Int) -> [Int] {\n        return [0, y]\n    }\n}\n",
  rust: "impl Solution {\n    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {\n        vec![0, y]\n    }\n}\n",
  ruby: "def two_sum(nums, target)\n  x = 1\n  return [0, 1)]\nend\n",
  php: "class Solution {\n    function twoSum($nums, $target) {\n        return [0, 1));\n    }\n}\n",
  dart: "class Solution {\n  List<int> twoSum(List<int> nums, int target) {\n    return [0, y];\n  }\n}\n",
};

/**
 * 起始代码（力扣原样，方法体是空的）补成能编译的样子：每个空方法体里放一句「还没写」（返回默认值或抛异常），
 * 用来检查判题程序和起始代码的签名对得上（starters.test.mjs）。构造函数、没有返回值的方法留空。
 */
export function fillStarter(lang, code) {
  const lines = code.split("\n"), out = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    const head = lines[i];
    if (!(i + 2 < lines.length && /^\s*$/.test(lines[i + 1]) && /^\s*\}\s*$/.test(lines[i + 2]))) continue;
    if (!/\)[^(){};]*\{\s*$/.test(head)) continue;
    const fill = filler(lang, head);
    if (fill) { out.push(lines[i + 1].replace(/\s*$/, "") + (lines[i + 1].trim() ? "" : " ".repeat(head.match(/^\s*/)[0].length + 4)) + fill); i++; }
  }
  return out.join("\n");
}
function filler(lang, head) {
  switch (lang) {
    case "c": return /^\s*void\s/.test(head) ? "" : "return 0;";
    case "csharp": return /\bvoid\b/.test(head) || !/\)\s*\{\s*$/.test(head) || /^\s*public\s+\w+\s*\(/.test(head) ? "" : "return default;";
    case "kotlin": return /\)\s*:\s*(?!Unit\b)[\w<>?, ]+\s*\{\s*$/.test(head) ? "TODO()" : "";
    case "scala": return /\)\s*:\s*(?!Unit\b)[\w\[\], ]+\s*=\s*\{\s*$/.test(head) ? "???" : "";
    case "swift": return /->/.test(head) ? "fatalError(\"还没写\")" : "";
    case "rust": return /->\s*Self\b/.test(head) ? "Self {}" : /->/.test(head) ? "Default::default()" : "";
    case "dart": return /^\s*void\s/.test(head) || /^\s*[A-Z]\w*\s*\(/.test(head) ? "" : "throw UnimplementedError();";
  }
  return "";
}
