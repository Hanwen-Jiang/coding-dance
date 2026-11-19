// 判题程序的 Rust 部分（接在用户代码后面）：力扣 Rust 环境里现成的 Solution 和两个节点类型，建参数、把结果写成 JSON。
// 用户代码里常有 use std::rc::Rc;，这里一律写全路径、其余放进 mod __j，免得名字撞上。
pub struct Solution;

#[derive(PartialEq, Eq, Clone, Debug)]
pub struct ListNode {
    pub val: i32,
    pub next: Option<Box<ListNode>>,
}

impl ListNode {
    #[inline]
    fn new(val: i32) -> Self {
        ListNode { next: None, val }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub struct TreeNode {
    pub val: i32,
    pub left: Option<std::rc::Rc<std::cell::RefCell<TreeNode>>>,
    pub right: Option<std::rc::Rc<std::cell::RefCell<TreeNode>>>,
}

impl TreeNode {
    #[inline]
    pub fn new(val: i32) -> Self {
        TreeNode { val, left: None, right: None }
    }
}

#[allow(dead_code)]
mod __j {
    use super::{ListNode, TreeNode};
    use std::cell::RefCell;
    use std::rc::Rc;

    pub type Tree = Option<Rc<RefCell<TreeNode>>>;

    thread_local! {
        static LAST_TREE: RefCell<Tree> = RefCell::new(None);
        pub static PANIC: RefCell<String> = RefCell::new(String::new());
    }

    pub fn reset() { LAST_TREE.with(|t| *t.borrow_mut() = None); }

    pub fn list(v: &[i32]) -> Option<Box<ListNode>> {
        let mut head: Option<Box<ListNode>> = None;
        for &x in v.iter().rev() {
            let mut n = Box::new(ListNode::new(x));
            n.next = head;
            head = Some(n);
        }
        head
    }

    pub fn tree(v: &[Option<i32>]) -> Tree {
        reset();
        let first = match v.first() { Some(Some(x)) => *x, _ => return None };
        let root = Rc::new(RefCell::new(TreeNode::new(first)));
        let mut q = vec![root.clone()];
        let (mut i, mut h) = (1, 0);
        while i < v.len() && h < q.len() {
            let node = q[h].clone();
            h += 1;
            if let Some(x) = v[i] { let c = Rc::new(RefCell::new(TreeNode::new(x))); node.borrow_mut().left = Some(c.clone()); q.push(c); }
            i += 1;
            if i < v.len() {
                if let Some(x) = v[i] { let c = Rc::new(RefCell::new(TreeNode::new(x))); node.borrow_mut().right = Some(c.clone()); q.push(c); }
                i += 1;
            }
        }
        LAST_TREE.with(|t| *t.borrow_mut() = Some(root.clone()));
        Some(root)
    }

    pub fn find(v: i32) -> Tree {
        let mut st: Vec<Rc<RefCell<TreeNode>>> = LAST_TREE.with(|t| t.borrow().iter().cloned().collect());
        while let Some(t) = st.pop() {
            if t.borrow().val == v { return Some(t); }
            if let Some(l) = t.borrow().left.clone() { st.push(l); }
            if let Some(r) = t.borrow().right.clone() { st.push(r); }
        }
        None
    }

    pub fn tree_val(t: &Tree) -> String { match t { None => "null".into(), Some(n) => n.borrow().val.to_string() } }

    pub fn q(s: &str) -> String {
        let mut o = String::from("\"");
        for c in s.chars() {
            match c {
                '"' => o.push_str("\\\""),
                '\\' => o.push_str("\\\\"),
                '\n' => o.push_str("\\n"),
                '\r' => o.push_str("\\r"),
                '\t' => o.push_str("\\t"),
                c if (c as u32) < 0x20 => o.push_str(&format!("\\u{:04x}", c as u32)),
                c => o.push(c),
            }
        }
        o.push('"');
        o
    }

    /// 能输出的类型（数组、Option 按元素递归）
    pub trait J { fn j(&self) -> String; }
    impl J for i32 { fn j(&self) -> String { self.to_string() } }
    impl J for i64 { fn j(&self) -> String { self.to_string() } }
    impl J for usize { fn j(&self) -> String { self.to_string() } }
    impl J for u32 { fn j(&self) -> String { self.to_string() } }
    impl J for f64 { fn j(&self) -> String { if self.is_finite() { format!("{:?}", self) } else { "null".into() } } }
    impl J for f32 { fn j(&self) -> String { (*self as f64).j() } }
    impl J for bool { fn j(&self) -> String { self.to_string() } }
    impl J for char { fn j(&self) -> String { q(&self.to_string()) } }
    impl J for String { fn j(&self) -> String { q(self) } }
    impl J for &str { fn j(&self) -> String { q(self) } }
    impl J for () { fn j(&self) -> String { "null".into() } }
    impl<T: J> J for Vec<T> { fn j(&self) -> String { format!("[{}]", self.iter().map(|x| x.j()).collect::<Vec<_>>().join(",")) } }
    impl<T: J> J for Option<T> { fn j(&self) -> String { match self { None => "null".into(), Some(x) => x.j() } } }
    impl<T: J> J for &T { fn j(&self) -> String { (*self).j() } }
    impl J for Box<ListNode> {
        fn j(&self) -> String {
            let mut out = vec![];
            let mut p: Option<&ListNode> = Some(self);
            while let Some(n) = p {
                if out.len() >= 100000 { break; }
                out.push(n.val.to_string());
                p = n.next.as_deref();
            }
            format!("[{}]", out.join(","))
        }
    }
    impl J for Rc<RefCell<TreeNode>> {
        fn j(&self) -> String {
            let mut q: Vec<Tree> = vec![Some(self.clone())];
            let mut vals: Vec<String> = vec![];
            let mut h = 0;
            while h < q.len() && q.len() < 400000 {
                let t = q[h].clone();
                h += 1;
                match t {
                    None => vals.push("null".into()),
                    Some(n) => { let b = n.borrow(); vals.push(b.val.to_string()); q.push(b.left.clone()); q.push(b.right.clone()); }
                }
            }
            while vals.last().map(|s| s == "null").unwrap_or(false) { vals.pop(); }
            format!("[{}]", vals.join(","))
        }
    }
    pub fn out<T: J>(x: &T) -> String { x.j() }
}
