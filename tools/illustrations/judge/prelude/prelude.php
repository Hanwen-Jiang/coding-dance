// 判题程序的 PHP 部分（放在用户代码前面，前面已经有 <?php）。节点类型用户自己声明了就用用户的（顶层的类在编译时就声明好了）。
// 力扣 PHP 环境里现成的节点类型；按签名把 JSON 输入变成参数、把结果变回 JSON（和 runner.py 同一套）
if (!class_exists('ListNode', false)) {
class ListNode {
    public $val = 0;
    public $next = null;
    function __construct($val = 0, $next = null) {
        $this->val = $val;
        $this->next = $next;
    }
}
}

if (!class_exists('TreeNode', false)) {
class TreeNode {
    public $val = null;
    public $left = null;
    public $right = null;
    function __construct($val = 0, $left = null, $right = null) {
        $this->val = $val;
        $this->left = $left;
        $this->right = $right;
    }
}
}

if (!class_exists('Node', false)) {
class Node {
    public $val = null;
    public $next = null;
    public $random = null;
    function __construct($val = 0) {
        $this->val = $val;
        $this->next = null;
        $this->random = null;
    }
}
}

final class JudgeH {
    // 本用例建出的节点：要按「是不是同一个节点」判的题用（见 judge/util.js 里的类型说明）
    static $nodes = [];
    static $tree = null;
    static $made = [];

    static function reset() { self::$nodes = []; self::$tree = null; self::$made = []; }

    static function lst($vals) {
        $nodes = [];
        foreach ($vals as $v) $nodes[] = new ListNode($v);
        for ($i = 0; $i + 1 < count($nodes); $i++) $nodes[$i]->next = $nodes[$i + 1];
        foreach ($nodes as $n) self::$nodes[] = $n;
        return $nodes;
    }

    static function tree($v) {
        if (count($v) == 0 || $v[0] === null) return null;
        $root = new TreeNode($v[0]);
        $q = [$root];
        $i = 1;
        for ($h = 0; $i < count($v) && $h < count($q); $h++) {
            $node = $q[$h];
            if ($v[$i] !== null) { $node->left = new TreeNode($v[$i]); $q[] = $node->left; }
            $i++;
            if ($i < count($v)) {
                if ($v[$i] !== null) { $node->right = new TreeNode($v[$i]); $q[] = $node->right; }
                $i++;
            }
        }
        return $root;
    }

    static function find($root, $v) {
        $st = [$root];
        while ($st) {
            $n = array_pop($st);
            if ($n === null) continue;
            if ($n->val == $v) return $n;
            $st[] = $n->left;
            $st[] = $n->right;
        }
        return null;
    }

    static function jin($t, $v) {
        switch ($t) {
            case 'ListNode': { $n = self::lst($v); return $n ? $n[0] : null; }
            case 'CycleList': {
                [$vals, $pos] = $v;
                $n = self::lst($vals);
                if ($n && $pos !== null && $pos >= 0) $n[count($n) - 1]->next = $n[$pos];
                return $n ? $n[0] : null;
            }
            case 'JoinList': {
                [$vals, $k] = $v;
                $tail = $k !== null && $k >= 0 ? self::$nodes[$k] : null;
                $n = self::lst($vals);
                if (!$n) return $tail;
                $n[count($n) - 1]->next = $tail;
                return $n[0];
            }
            case 'TreeNode': self::$tree = self::tree($v); return self::$tree;
            case 'TreeRef': return self::find(self::$tree, $v);
            case 'RandomList': {
                $nodes = [];
                foreach ($v as $x) $nodes[] = new Node($x[0]);
                foreach ($v as $i => $x) {
                    $nodes[$i]->next = $nodes[$i + 1] ?? null;
                    $nodes[$i]->random = $x[1] === null ? null : $nodes[$x[1]];
                }
                self::$made = $nodes;
                return $nodes ? $nodes[0] : null;
            }
            case 'ListNode[]': { $out = []; foreach ($v as $x) { $n = self::lst($x); $out[] = $n ? $n[0] : null; } return $out; }
        }
        return $v;
    }

    static function plain($v) {
        if ($v === null || is_bool($v) || is_int($v) || is_string($v)) return $v;
        if (is_float($v)) return is_finite($v) ? $v : null;
        if ($v instanceof ListNode) {
            $out = [];
            for ($p = $v; $p !== null && count($out) < 100000; $p = $p->next) $out[] = $p->val;
            return $out;
        }
        if ($v instanceof TreeNode) {
            $q = [$v];
            $out = [];
            for ($h = 0; $h < count($q) && count($q) < 400000; $h++) {
                $t = $q[$h];
                if ($t === null) { $out[] = null; continue; }
                $out[] = $t->val;
                $q[] = $t->left;
                $q[] = $t->right;
            }
            while ($out && end($out) === null) array_pop($out);
            return $out;
        }
        if (is_array($v)) return array_map([self::class, 'plain'], array_values($v));
        if ($v instanceof Traversable) return self::plain(iterator_to_array($v, false));
        return (string)$v;
    }

    static function jout($t, $v) {
        if ($t === 'NodeIndex') {
            if ($v === null) return null;
            foreach (self::$nodes as $i => $n) if ($n === $v) return $i;
            return '不是输入里的节点';
        }
        if ($t === 'TreeVal') return $v === null ? null : $v->val;
        if ($t === 'RandomList') {
            $idx = new SplObjectStorage();
            for ($p = $v; $p !== null && count($idx) < 100000; $p = $p->next) $idx[$p] = count($idx);
            $old = new SplObjectStorage();
            foreach (self::$made as $n) $old->attach($n);
            $out = [];
            for ($p = $v; $p !== null && count($out) < 100000; $p = $p->next) {
                if ($old->contains($p)) return '没有复制：返回了原链表的节点';
                $r = $p->random;
                $out[] = [$p->val, $r === null ? null : ($idx->contains($r) ? $idx[$r] : '?')];
            }
            return $out;
        }
        return self::plain($v);
    }

    static function json($v) {
        return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_INVALID_UTF8_SUBSTITUTE);
    }

    // 跑一个用例，返回要输出的结果
    static function runCase($sig, $c, $names) {
        self::reset();
        if ($sig['kind'] === 'design') {
            [$ops, $argv] = $c;
            $cls = $sig['cls'];
            $args = [];
            foreach ($sig['ctor'] as $i => $t) $args[] = self::jin($t, $argv[0][$i]);
            $obj = new $cls(...$args);
            $out = [null];
            for ($k = 1; $k < count($ops); $k++) {
                $m = $sig['methods'][$ops[$k]];
                $a = [];
                foreach ($m['params'] as $i => $t) $a[] = self::jin($t, $argv[$k][$i]);
                $r = $obj->{$names[$ops[$k]]}(...$a);
                $out[] = $m['ret'] === 'void' ? null : self::jout($m['ret'], $r);
            }
            return $out;
        }
        $args = [];
        foreach ($sig['params'] as $i => $t) $args[] = self::jin($t, $c[$i]);
        // 原地修改的题参数按引用传（力扣的模板写 &$nums）
        $refs = [];
        foreach ($args as $i => &$a) $refs[$i] = &$a;
        unset($a);
        $r = call_user_func_array([new Solution(), $names['__fn']], $refs);
        return $sig['ret'] === 'void' ? self::jout($sig['params'][$sig['out']], $args[$sig['out']]) : self::jout($sig['ret'], $r);
    }
}
