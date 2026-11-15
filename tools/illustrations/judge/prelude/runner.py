
# —— 判题器追加的部分：按签名把 JSON 输入变成参数，调用题解，每个用例输出一行 JSON ——
import json as __json, sys as __sys, copy as __copy

def __jin(t, v):
    if t == "ListNode": return L(v)
    if t == "TreeNode": return T(v)
    if t == "ListNode[]": return [L(x) for x in v]
    return __copy.deepcopy(v)

def __jout(t, v):
    if t == "ListNode": return toL(v)
    if t == "TreeNode": return toT(v)
    return v

def __jmain():
    spec = __json.loads(open(__sys.argv[1], encoding="utf-8").read())
    sig = spec["sig"]
    for case in spec["cases"]:
        try:
            if sig["kind"] == "design":
                ops, argv = case
                obj = globals()[sig["cls"]](*[__jin(t, v) for t, v in zip(sig["ctor"], argv[0])])
                out = [None]
                for name, a in zip(ops[1:], argv[1:]):
                    m = sig["methods"][name]
                    r = getattr(obj, name)(*[__jin(t, v) for t, v in zip(m["params"], a)])
                    out.append(None if m["ret"] == "void" else __jout(m["ret"], r))
            else:
                args = [__jin(t, v) for t, v in zip(sig["params"], case)]
                r = getattr(Solution(), sig["fn"])(*args)
                out = __jout(sig["params"][sig["out"]], args[sig["out"]]) if sig["ret"] == "void" else __jout(sig["ret"], r)
            print(__json.dumps(out))
        except Exception as e:
            print(__json.dumps({"__error": repr(e)}))
        __sys.stdout.flush()

__jmain()
