package builder

import (
	"fmt"
	"regexp"
	"strings"
	"unicode/utf16"
)

// PracticeLangs lists all 15 practice languages (first 3 run in browser WASM/TS; remaining 12 via cd-runner).
var PracticeLangs = []string{
	"python", "javascript", "typescript",
	"java", "cpp", "go",
	"c", "csharp", "kotlin", "swift", "rust", "ruby", "php", "scala", "dart",
}

// CloudLangs lists the 9 later-added cloud runner languages whose templates come verbatim from LeetCode/authored starters.
var CloudLangs = []string{"c", "csharp", "kotlin", "swift", "rust", "ruby", "php", "scala", "dart"}

// BrowserLangs lists the 3 browser-executed languages with legacy/previous template hashes.
var BrowserLangs = []string{"python", "javascript", "typescript"}

var (
	reCamelToSnake1 = regexp.MustCompile(`([a-z0-9])([A-Z])`)
	reCamelToSnake2 = regexp.MustCompile(`([A-Z]+)([A-Z][a-z])`)
	rePyAnyMethod   = regexp.MustCompile(`(?m)^    def (\w+)\(([^\n]*)\)(?: -> ([^:\n]+))?:`)
	reWordNull      = regexp.MustCompile(`\bnull\b`)
	reWordTrue      = regexp.MustCompile(`\btrue\b`)
	reWordFalse     = regexp.MustCompile(`\bfalse\b`)
	reNodeType      = regexp.MustCompile(`Node|List|Tree`)
)

var rubyKeep = map[string]bool{
	"copyRandomList":      true,
	"hasCycle":            true,
	"detectCycle":         true,
	"getIntersectionNode": true,
}

func CapFirst(s string) string {
	if s == "" {
		return ""
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func LCFirst(s string) string {
	if s == "" {
		return ""
	}
	return strings.ToLower(s[:1]) + s[1:]
}

func SnakeCase(s string) string {
	out := reCamelToSnake1.ReplaceAllString(s, "${1}_${2}")
	out = reCamelToSnake2.ReplaceAllString(out, "${1}_${2}")
	return strings.ToLower(out)
}

// FnName returns the judge/LeetCode function name for function-style problems in a cloud language.
func FnName(lang, fn string) string {
	switch lang {
	case "csharp":
		return CapFirst(fn)
	case "rust":
		return SnakeCase(fn)
	case "ruby":
		if rubyKeep[fn] {
			return fn
		}
		return SnakeCase(fn)
	default:
		return fn
	}
}

// MethodName returns the judge/LeetCode method name for design-class problems in a cloud language.
func MethodName(lang, cls, m string) string {
	switch lang {
	case "c":
		return LCFirst(cls) + CapFirst(m)
	case "csharp":
		return CapFirst(m)
	case "rust", "ruby":
		return SnakeCase(m)
	default:
		return m
	}
}

// StarterHash computes the 32-bit FNV-1a hash over UTF-16 code units, matching JS starterHash in templates.cjs.
func StarterHash(value string) string {
	units := utf16.Encode([]rune(value))
	var hash uint32 = 0x811c9dc5
	for _, u := range units {
		hash = (hash ^ uint32(u)) * 0x01000193
	}
	return fmt.Sprintf("%08x", hash)
}

func splitPythonParams(s string) []string {
	var out []string
	depth, start := 0, 0
	for i := 0; i < len(s); i++ {
		switch s[i] {
		case '[', '(':
			depth++
		case ']', ')':
			depth--
		case ',':
			if depth == 0 {
				part := strings.TrimSpace(s[start:i])
				if part != "" && part != "self" {
					out = append(out, part)
				}
				start = i + 1
			}
		}
	}
	last := strings.TrimSpace(s[start:])
	if last != "" && last != "self" {
		out = append(out, last)
	}
	return out
}

func typeFromPython(t string) string {
	t = strings.TrimSpace(t)
	if strings.HasPrefix(t, "Optional[") && strings.HasSuffix(t, "]") {
		return typeFromPython(t[9 : len(t)-1])
	}
	if strings.HasPrefix(t, "List[") && strings.HasSuffix(t, "]") {
		return typeFromPython(t[5:len(t)-1]) + "[]"
	}
	switch t {
	case "str":
		return "string"
	case "float":
		return "double"
	case "None":
		return "void"
	default:
		return t
	}
}

// ExtractPythonMethodParams parses a Python method header (`    def <name>(self, ...):`) for parameter names and types.
func ExtractPythonMethodParams(code, name string) (fn string, names []string, paramTypes []string, ret string, err error) {
	var rawParams, rawRet string
	if name != "" {
		re := regexp.MustCompile(`(?m)^    def ` + regexp.QuoteMeta(name) + `\(([^\n]*)\)(?: -> ([^:\n]+))?:`)
		m := re.FindStringSubmatch(code)
		if m == nil {
			return "", nil, nil, "", fmt.Errorf("cannot read Python method %s", name)
		}
		fn = name
		rawParams = m[1]
		rawRet = m[2]
	} else {
		m := rePyAnyMethod.FindStringSubmatch(code)
		if m == nil {
			return "", nil, nil, "", fmt.Errorf("cannot read Python method Solution")
		}
		fn = m[1]
		rawParams = m[2]
		rawRet = m[3]
	}
	parts := splitPythonParams(rawParams)
	names = make([]string, len(parts))
	paramTypes = make([]string, len(parts))
	for i, p := range parts {
		colon := strings.IndexByte(p, ':')
		if colon < 0 {
			names[i] = strings.TrimSpace(p)
			paramTypes[i] = "int"
		} else {
			names[i] = strings.TrimSpace(p[:colon])
			paramTypes[i] = typeFromPython(p[colon+1:])
		}
	}
	if strings.TrimSpace(rawRet) == "" {
		ret = "void"
	} else {
		ret = typeFromPython(rawRet)
	}
	return fn, names, paramTypes, ret, nil
}

func sigItemType(t string) (string, bool) {
	if strings.HasSuffix(t, "[]") {
		return t[:len(t)-2], true
	}
	if strings.HasPrefix(t, "List<") && strings.HasSuffix(t, ">") {
		return t[5 : len(t)-1], true
	}
	return "", false
}

func tsType(t string) string {
	if item, ok := sigItemType(t); ok {
		inner := tsType(item)
		if strings.Contains(inner, "|") {
			return "(" + inner + ")[]"
		}
		return inner + "[]"
	}
	switch t {
	case "int", "long", "double":
		return "number"
	case "bool":
		return "boolean"
	case "string", "char":
		return "string"
	case "void":
		return "void"
	case "ListNode", "CycleList", "JoinList", "NodeIndex", "TreeVal":
		if t == "TreeVal" {
			return "TreeNode | null"
		}
		return "ListNode | null"
	case "TreeNode":
		return "TreeNode | null"
	case "TreeRef":
		return "TreeNode"
	case "RandomList":
		return "_Node | null"
	default:
		return "unknown"
	}
}

func pyType(t string) string {
	if item, ok := sigItemType(t); ok {
		return "List[" + pyType(item) + "]"
	}
	switch t {
	case "int", "long":
		return "int"
	case "double":
		return "float"
	case "bool":
		return "bool"
	case "string", "char":
		return "str"
	case "void":
		return "None"
	case "ListNode", "CycleList", "JoinList", "NodeIndex":
		return "Optional[ListNode]"
	case "TreeNode", "TreeVal":
		return "Optional[TreeNode]"
	case "TreeRef":
		return "TreeNode"
	case "RandomList":
		return "Optional[Node]"
	default:
		return "Any"
	}
}

func jsDocType(t string) string {
	if item, ok := sigItemType(t); ok {
		return jsDocType(item) + "[]"
	}
	switch t {
	case "int", "long", "double":
		return "number"
	case "bool":
		return "boolean"
	case "string":
		return "string"
	case "char":
		return "character"
	case "void":
		return "void"
	case "ListNode", "CycleList", "JoinList", "NodeIndex":
		return "ListNode"
	case "TreeNode", "TreeRef", "TreeVal":
		return "TreeNode"
	case "RandomList":
		return "_Node"
	default:
		return "any"
	}
}

func javaType(t string) string {
	if strings.HasSuffix(t, "[]") {
		return javaType(t[:len(t)-2]) + "[]"
	}
	if strings.HasPrefix(t, "List<") && strings.HasSuffix(t, ">") {
		item := t[5 : len(t)-1]
		switch item {
		case "int":
			return "List<Integer>"
		case "long":
			return "List<Long>"
		case "double":
			return "List<Double>"
		case "bool":
			return "List<Boolean>"
		case "char":
			return "List<Character>"
		default:
			return "List<" + javaType(item) + ">"
		}
	}
	switch t {
	case "int":
		return "int"
	case "long":
		return "long"
	case "double":
		return "double"
	case "bool":
		return "boolean"
	case "string":
		return "String"
	case "char":
		return "char"
	case "void":
		return "void"
	case "ListNode", "CycleList", "JoinList", "NodeIndex":
		return "ListNode"
	case "TreeNode", "TreeRef", "TreeVal":
		return "TreeNode"
	case "RandomList":
		return "Node"
	default:
		return "Object"
	}
}

func cppType(t string) string {
	if item, ok := sigItemType(t); ok {
		return "vector<" + cppType(item) + ">"
	}
	switch t {
	case "int":
		return "int"
	case "long":
		return "long long"
	case "double":
		return "double"
	case "bool":
		return "bool"
	case "string":
		return "string"
	case "char":
		return "char"
	case "void":
		return "void"
	case "ListNode", "CycleList", "JoinList", "NodeIndex":
		return "ListNode*"
	case "TreeNode", "TreeRef", "TreeVal":
		return "TreeNode*"
	case "RandomList":
		return "Node*"
	default:
		return "auto"
	}
}

func cppParam(t string) string {
	if _, ok := sigItemType(t); ok {
		return cppType(t) + "&"
	}
	return cppType(t)
}

func goType(t string) string {
	if item, ok := sigItemType(t); ok {
		return "[]" + goType(item)
	}
	switch t {
	case "int":
		return "int"
	case "long":
		return "int64"
	case "double":
		return "float64"
	case "bool":
		return "bool"
	case "string":
		return "string"
	case "char":
		return "byte"
	case "void":
		return ""
	case "ListNode", "CycleList", "JoinList", "NodeIndex":
		return "*ListNode"
	case "TreeNode", "TreeRef", "TreeVal":
		return "*TreeNode"
	case "RandomList":
		return "*Node"
	default:
		return "any"
	}
}

func rawOutType(sig RawSignature) string {
	if sig.Ret == "void" {
		idx := 0
		if sig.Out != nil {
			idx = *sig.Out
		}
		if idx >= 0 && idx < len(sig.Params) {
			return sig.Params[idx]
		}
	}
	return sig.Ret
}

type starterNodeKinds struct {
	list, tree, random bool
}

func detectNodeKinds(sig RawSignature) starterNodeKinds {
	var all []string
	all = append(all, sig.Params...)
	if sig.Ret != "" {
		all = append(all, sig.Ret)
	}
	all = append(all, sig.Ctor...)
	for _, m := range sig.Methods {
		all = append(all, m.Params...)
		if m.Ret != "" {
			all = append(all, m.Ret)
		}
	}
	var out starterNodeKinds
	for _, t := range all {
		if t == "" {
			continue
		}
		for {
			if item, ok := sigItemType(t); ok {
				t = item
				continue
			}
			break
		}
		switch t {
		case "ListNode", "CycleList", "JoinList", "NodeIndex":
			out.list = true
		case "TreeNode", "TreeRef", "TreeVal":
			out.tree = true
		case "RandomList":
			out.random = true
		}
	}
	return out
}

type langDefs struct {
	list, tree, random string
}

var templateDefs = map[string]langDefs{
	"python": {
		list:   "# Definition for singly-linked list.\n# class ListNode:\n#     def __init__(self, val=0, next=None):\n#         self.val = val\n#         self.next = next\n",
		tree:   "# Definition for a binary tree node.\n# class TreeNode:\n#     def __init__(self, val=0, left=None, right=None):\n#         self.val = val\n#         self.left = left\n#         self.right = right\n",
		random: "\"\"\"\n# Definition for a Node.\nclass Node:\n    def __init__(self, x: int, next: 'Node' = None, random: 'Node' = None):\n        self.val = int(x)\n        self.next = next\n        self.random = random\n\"\"\"\n\n",
	},
	"javascript": {
		list:   "/**\n * Definition for singly-linked list.\n * function ListNode(val, next) {\n *     this.val = (val===undefined ? 0 : val)\n *     this.next = (next===undefined ? null : next)\n * }\n */\n",
		tree:   "/**\n * Definition for a binary tree node.\n * function TreeNode(val, left, right) {\n *     this.val = (val===undefined ? 0 : val)\n *     this.left = (left===undefined ? null : left)\n *     this.right = (right===undefined ? null : right)\n * }\n */\n",
		random: "/**\n * // Definition for a _Node.\n * function _Node(val, next, random) {\n *    this.val = val;\n *    this.next = next;\n *    this.random = random;\n * };\n */\n\n",
	},
	"typescript": {
		list:   "/**\n * Definition for singly-linked list.\n * class ListNode {\n *     val: number\n *     next: ListNode | null\n *     constructor(val?: number, next?: ListNode | null) {\n *         this.val = (val===undefined ? 0 : val)\n *         this.next = (next===undefined ? null : next)\n *     }\n * }\n */\n\n",
		tree:   "/**\n * Definition for a binary tree node.\n * class TreeNode {\n *     val: number\n *     left: TreeNode | null\n *     right: TreeNode | null\n *     constructor(val?: number, left?: TreeNode | null, right?: TreeNode | null) {\n *         this.val = (val===undefined ? 0 : val)\n *         this.left = (left===undefined ? null : left)\n *         this.right = (right===undefined ? null : right)\n *     }\n * }\n */\n\n",
		random: "/**\n * Definition for _Node.\n * class _Node {\n *     val: number\n *     next: _Node | null\n *     random: _Node | null\n *\n *     constructor(val?: number, next?: _Node, random?: _Node) {\n *         this.val = (val===undefined ? 0 : val)\n *         this.next = (next===undefined ? null : next)\n *         this.random = (random===undefined ? null : random)\n *     }\n * }\n */\n\n",
	},
	"java": {
		list:   "/**\n * Definition for singly-linked list.\n * public class ListNode {\n *     int val;\n *     ListNode next;\n *     ListNode() {}\n *     ListNode(int val) { this.val = val; }\n *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }\n * }\n */\n",
		tree:   "/**\n * Definition for a binary tree node.\n * public class TreeNode {\n *     int val;\n *     TreeNode left;\n *     TreeNode right;\n *     TreeNode() {}\n *     TreeNode(int val) { this.val = val; }\n *     TreeNode(int val, TreeNode left, TreeNode right) {\n *         this.val = val;\n *         this.left = left;\n *         this.right = right;\n *     }\n * }\n */\n",
		random: "/*\n// Definition for a Node.\nclass Node {\n    int val;\n    Node next;\n    Node random;\n\n    public Node(int val) {\n        this.val = val;\n        this.next = null;\n        this.random = null;\n    }\n}\n*/\n\n",
	},
	"cpp": {
		list:   "/**\n * Definition for singly-linked list.\n * struct ListNode {\n *     int val;\n *     ListNode *next;\n *     ListNode() : val(0), next(nullptr) {}\n *     ListNode(int x) : val(x), next(nullptr) {}\n *     ListNode(int x, ListNode *next) : val(x), next(next) {}\n * };\n */\n",
		tree:   "/**\n * Definition for a binary tree node.\n * struct TreeNode {\n *     int val;\n *     TreeNode *left;\n *     TreeNode *right;\n *     TreeNode() : val(0), left(nullptr), right(nullptr) {}\n *     TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}\n *     TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}\n * };\n */\n",
		random: "/*\n// Definition for a Node.\nclass Node {\npublic:\n    int val;\n    Node* next;\n    Node* random;\n    \n    Node(int _val) {\n        val = _val;\n        next = NULL;\n        random = NULL;\n    }\n};\n*/\n\n",
	},
	"go": {
		list:   "/**\n * Definition for singly-linked list.\n * type ListNode struct {\n *     Val int\n *     Next *ListNode\n * }\n */\n",
		tree:   "/**\n * Definition for a binary tree node.\n * type TreeNode struct {\n *     Val int\n *     Left *TreeNode\n *     Right *TreeNode\n * }\n */\n",
		random: "/**\n * Definition for a Node.\n * type Node struct {\n *     Val int\n *     Next *Node\n *     Random *Node\n * }\n */\n\n",
	},
}

func headDefs(sig RawSignature, lang string) string {
	k := detectNodeKinds(sig)
	d := templateDefs[lang]
	var sb strings.Builder
	if k.random {
		sb.WriteString(d.random)
	}
	if k.list {
		sb.WriteString(d.list)
	}
	if k.tree {
		sb.WriteString(d.tree)
	}
	return sb.String()
}

func defaultParamNames(cls string, count int, isCtor bool) []string {
	out := make([]string, count)
	for i := 0; i < count; i++ {
		if isCtor && cls == "LRUCache" {
			out[i] = "capacity"
		} else if i == 0 {
			out[i] = "key"
		} else if i == 1 {
			out[i] = "value"
		} else {
			out[i] = fmt.Sprintf("arg%d", i+1)
		}
	}
	return out
}

func methodArgNames(cls, method string, params []string, methodNames map[string][]string) []string {
	if ns, ok := methodNames[method]; ok {
		return ns
	}
	return defaultParamNames(cls, len(params), false)
}

func nativeTemplate(sig RawSignature, parameterNames []string, lang string, methodNames map[string][]string) string {
	head := headDefs(sig, lang)
	ctorNames := defaultParamNames(sig.Cls, len(sig.Ctor), true)
	switch lang {
	case "java":
		if sig.Cls != "" {
			usage := []string{fmt.Sprintf("%s obj = new %s(%s);", sig.Cls, sig.Cls, strings.Join(ctorNames, ","))}
			n := 0
			for _, m := range sig.Methods {
				ns := methodArgNames(sig.Cls, m.Name, m.Params, methodNames)
				call := fmt.Sprintf("obj.%s(%s);", m.Name, strings.Join(ns, ","))
				if m.Ret == "void" {
					usage = append(usage, call)
				} else {
					n++
					usage = append(usage, fmt.Sprintf("%s param_%d = %s", javaType(m.Ret), n, call))
				}
			}
			var ctorParams []string
			for i, t := range sig.Ctor {
				ctorParams = append(ctorParams, javaType(t)+" "+ctorNames[i])
			}
			var sb strings.Builder
			fmt.Fprintf(&sb, "class %s {\n\n    public %s(%s) {\n        \n    }\n", sig.Cls, sig.Cls, strings.Join(ctorParams, ", "))
			for _, m := range sig.Methods {
				ns := methodArgNames(sig.Cls, m.Name, m.Params, methodNames)
				var mParams []string
				for i, t := range m.Params {
					mParams = append(mParams, javaType(t)+" "+ns[i])
				}
				fmt.Fprintf(&sb, "    \n    public %s %s(%s) {\n        \n    }\n", javaType(m.Ret), m.Name, strings.Join(mParams, ", "))
			}
			fmt.Fprintf(&sb, "}\n\n/**\n * Your %s object will be instantiated and called as such:\n", sig.Cls)
			for _, u := range usage {
				fmt.Fprintf(&sb, " * %s\n", u)
			}
			sb.WriteString(" */")
			return sb.String()
		}
		var ps []string
		for i, t := range sig.Params {
			ps = append(ps, javaType(t)+" "+parameterNames[i])
		}
		return head + fmt.Sprintf("class Solution {\n    public %s %s(%s) {\n        \n    }\n}", javaType(sig.Ret), sig.Fn, strings.Join(ps, ", "))

	case "cpp":
		if sig.Cls != "" {
			usage := []string{fmt.Sprintf("%s* obj = new %s(%s);", sig.Cls, sig.Cls, strings.Join(ctorNames, ", "))}
			n := 0
			for _, m := range sig.Methods {
				ns := methodArgNames(sig.Cls, m.Name, m.Params, methodNames)
				call := fmt.Sprintf("obj->%s(%s);", m.Name, strings.Join(ns, ","))
				if m.Ret == "void" {
					usage = append(usage, call)
				} else {
					n++
					usage = append(usage, fmt.Sprintf("%s param_%d = %s", cppType(m.Ret), n, call))
				}
			}
			var ctorParams []string
			for i, t := range sig.Ctor {
				ctorParams = append(ctorParams, cppParam(t)+" "+ctorNames[i])
			}
			var sb strings.Builder
			fmt.Fprintf(&sb, "class %s {\npublic:\n    %s(%s) {\n        \n    }\n", sig.Cls, sig.Cls, strings.Join(ctorParams, ", "))
			for _, m := range sig.Methods {
				ns := methodArgNames(sig.Cls, m.Name, m.Params, methodNames)
				var mParams []string
				for i, t := range m.Params {
					mParams = append(mParams, cppParam(t)+" "+ns[i])
				}
				fmt.Fprintf(&sb, "    \n    %s %s(%s) {\n        \n    }\n", cppType(m.Ret), m.Name, strings.Join(mParams, ", "))
			}
			fmt.Fprintf(&sb, "};\n\n/**\n * Your %s object will be instantiated and called as such:\n", sig.Cls)
			for _, u := range usage {
				fmt.Fprintf(&sb, " * %s\n", u)
			}
			sb.WriteString(" */")
			return sb.String()
		}
		var ps []string
		for i, t := range sig.Params {
			ps = append(ps, cppParam(t)+" "+parameterNames[i])
		}
		return head + fmt.Sprintf("class Solution {\npublic:\n    %s %s(%s) {\n        \n    }\n};", cppType(sig.Ret), sig.Fn, strings.Join(ps, ", "))

	default: // go
		if sig.Cls != "" {
			usage := []string{fmt.Sprintf("obj := Constructor(%s);", strings.Join(ctorNames, ", "))}
			n := 0
			for _, m := range sig.Methods {
				ns := methodArgNames(sig.Cls, m.Name, m.Params, methodNames)
				call := fmt.Sprintf("obj.%s(%s);", CapFirst(m.Name), strings.Join(ns, ","))
				if m.Ret == "void" {
					usage = append(usage, call)
				} else {
					n++
					usage = append(usage, fmt.Sprintf("param_%d := %s", n, call))
				}
			}
			var ctorParams []string
			for i, t := range sig.Ctor {
				ctorParams = append(ctorParams, ctorNames[i]+" "+goType(t))
			}
			var sb strings.Builder
			fmt.Fprintf(&sb, "type %s struct {\n    \n}\n\n\nfunc Constructor(%s) %s {\n    \n}\n", sig.Cls, strings.Join(ctorParams, ", "), sig.Cls)
			for _, m := range sig.Methods {
				ns := methodArgNames(sig.Cls, m.Name, m.Params, methodNames)
				var mParams []string
				for i, t := range m.Params {
					mParams = append(mParams, ns[i]+" "+goType(t))
				}
				fmt.Fprintf(&sb, "\n\nfunc (this *%s) %s(%s) %s {\n    \n}\n", sig.Cls, CapFirst(m.Name), strings.Join(mParams, ", "), goType(m.Ret))
			}
			fmt.Fprintf(&sb, "\n\n/**\n * Your %s object will be instantiated and called as such:\n", sig.Cls)
			for _, u := range usage {
				fmt.Fprintf(&sb, " * %s\n", u)
			}
			sb.WriteString(" */")
			return sb.String()
		}
		var ps []string
		for i, t := range sig.Params {
			ps = append(ps, parameterNames[i]+" "+goType(t))
		}
		return head + fmt.Sprintf("func %s(%s) %s {\n    \n}", sig.Fn, strings.Join(ps, ", "), goType(sig.Ret))
	}
}

func usageLines(sig RawSignature, lang, comment, prefix string, ctorNames []string, methodNames map[string][]string) []string {
	lines := []string{
		prefix + fmt.Sprintf("Your %s object will be instantiated and called as such:", sig.Cls),
	}
	if comment == "#" {
		lines = append(lines, prefix+"obj = "+sig.Cls+"("+strings.Join(ctorNames, ", ")+")")
	} else {
		lines = append(lines, prefix+"var obj = new "+sig.Cls+"("+strings.Join(ctorNames, ", ")+")")
	}
	n := 0
	for _, m := range sig.Methods {
		mName := m.Name
		if lang == "python" && sig.PythonMethods[m.Name] != "" {
			mName = sig.PythonMethods[m.Name]
		}
		ns := methodArgNames(sig.Cls, m.Name, m.Params, methodNames)
		call := fmt.Sprintf("obj.%s(%s)", mName, strings.Join(ns, ","))
		if m.Ret == "void" {
			lines = append(lines, prefix+call)
		} else {
			n++
			if comment == "#" {
				lines = append(lines, prefix+fmt.Sprintf("param_%d = %s", n, call))
			} else {
				lines = append(lines, prefix+fmt.Sprintf("var param_%d = %s", n, call))
			}
		}
	}
	return lines
}

// LeetcodeTemplate builds starter code matching templates.cjs `leetcodeTemplate` for python/js/ts/java/cpp/go.
func LeetcodeTemplate(sig RawSignature, parameterNames []string, lang string, methodNames map[string][]string) string {
	if lang == "java" || lang == "cpp" || lang == "go" {
		return nativeTemplate(sig, parameterNames, lang, methodNames)
	}
	head := headDefs(sig, lang)
	ctorNames := defaultParamNames(sig.Cls, len(sig.Ctor), true)

	if lang == "python" {
		if sig.Cls != "" {
			var sb strings.Builder
			sb.WriteString(head)
			fmt.Fprintf(&sb, "class %s:\n\n    def __init__(self", sig.Cls)
			for i, n := range ctorNames {
				fmt.Fprintf(&sb, ", %s: %s", n, pyType(sig.Ctor[i]))
			}
			sb.WriteString("):\n        \n")
			for _, m := range sig.Methods {
				ps := methodArgNames(sig.Cls, m.Name, m.Params, methodNames)
				mName := m.Name
				if sig.PythonMethods[m.Name] != "" {
					mName = sig.PythonMethods[m.Name]
				}
				fmt.Fprintf(&sb, "\n    def %s(self", mName)
				for i, p := range m.Params {
					fmt.Fprintf(&sb, ", %s: %s", ps[i], pyType(p))
				}
				fmt.Fprintf(&sb, ") -> %s:\n        \n", pyType(m.Ret))
			}
			sb.WriteString("\n\n")
			sb.WriteString(strings.Join(usageLines(sig, "python", "#", "# ", ctorNames, methodNames), "\n"))
			sb.WriteString("\n")
			return sb.String()
		}
		fn := sig.Fn
		if sig.PythonFn != "" {
			fn = sig.PythonFn
		}
		var ps strings.Builder
		for i, t := range sig.Params {
			fmt.Fprintf(&ps, ", %s: %s", parameterNames[i], pyType(t))
		}
		return head + fmt.Sprintf("class Solution:\n    def %s(self%s) -> %s:\n        ", fn, ps.String(), pyType(sig.Ret))
	}

	jsDoc := func(ps, ns []string, ret string) string {
		if len(ps) == 0 && ret == "" {
			return ""
		}
		var sb strings.Builder
		sb.WriteString("/**\n")
		for i, t := range ps {
			fmt.Fprintf(&sb, " * @param {%s} %s\n", jsDocType(t), ns[i])
		}
		if ret != "" {
			fmt.Fprintf(&sb, " * @return {%s}\n", jsDocType(ret))
		}
		sb.WriteString(" */\n")
		return sb.String()
	}

	if lang == "javascript" {
		if sig.Cls != "" {
			usageBlock := "/**\n" + strings.Join(usageLines(sig, "javascript", "//", " * ", ctorNames, methodNames), "\n") + "\n */\n"
			var sb strings.Builder
			sb.WriteString(jsDoc(sig.Ctor, ctorNames, ""))
			fmt.Fprintf(&sb, "var %s = function(%s) {\n  \n};\n", sig.Cls, strings.Join(ctorNames, ", "))
			for _, m := range sig.Methods {
				ns := methodArgNames(sig.Cls, m.Name, m.Params, methodNames)
				fmt.Fprintf(&sb, "\n%s%s.prototype.%s = function(%s) {\n  \n};\n", jsDoc(m.Params, ns, m.Ret), sig.Cls, m.Name, strings.Join(ns, ", "))
			}
			sb.WriteString("\n")
			sb.WriteString(usageBlock)
			return sb.String()
		}
		return head + jsDoc(sig.Params, parameterNames, sig.Ret) + fmt.Sprintf("var %s = function(%s) {\n  \n};", sig.Fn, strings.Join(parameterNames, ", "))
	}

	// typescript
	typedParams := func(ps, ns []string) string {
		parts := make([]string, len(ps))
		for i, t := range ps {
			parts[i] = ns[i] + ": " + tsType(t)
		}
		return strings.Join(parts, ", ")
	}
	if sig.Cls != "" {
		usageBlock := "/**\n" + strings.Join(usageLines(sig, "typescript", "//", " * ", ctorNames, methodNames), "\n") + "\n */\n"
		var sb strings.Builder
		fmt.Fprintf(&sb, "class %s {\n  constructor(%s) {\n    \n  }\n", sig.Cls, typedParams(sig.Ctor, ctorNames))
		for _, m := range sig.Methods {
			ns := methodArgNames(sig.Cls, m.Name, m.Params, methodNames)
			fmt.Fprintf(&sb, "\n  %s(%s): %s {\n    \n  }\n", m.Name, typedParams(m.Params, ns), tsType(m.Ret))
		}
		sb.WriteString("}\n\n")
		sb.WriteString(usageBlock)
		return sb.String()
	}
	return head + fmt.Sprintf("function %s(%s): %s {\n  \n};", sig.Fn, typedParams(sig.Params, parameterNames), tsType(sig.Ret))
}

// PreviousLeetcodeTemplate matches templates.cjs `previousLeetcodeTemplate` for draft migration hashes.
func PreviousLeetcodeTemplate(sig RawSignature, parameterNames []string, lang string, methodNames map[string][]string) string {
	ctorNames := defaultParamNames(sig.Cls, len(sig.Ctor), true)
	if lang == "python" {
		header := "from typing import *\n\n# ListNode、TreeNode、Node 由测试环境提供。\n"
		if sig.Cls != "" {
			var sb strings.Builder
			sb.WriteString(header)
			fmt.Fprintf(&sb, "class %s:\n    def __init__(self", sig.Cls)
			for i, n := range ctorNames {
				fmt.Fprintf(&sb, ", %s: %s", n, pyType(sig.Ctor[i]))
			}
			sb.WriteString("):\n        # 初始化数据结构\n        pass\n")
			for _, m := range sig.Methods {
				ps := methodArgNames(sig.Cls, m.Name, m.Params, methodNames)
				mName := m.Name
				if sig.PythonMethods[m.Name] != "" {
					mName = sig.PythonMethods[m.Name]
				}
				fmt.Fprintf(&sb, "\n    def %s(self", mName)
				for i, p := range m.Params {
					fmt.Fprintf(&sb, ", %s: %s", ps[i], pyType(p))
				}
				fmt.Fprintf(&sb, ") -> %s:\n        raise NotImplementedError(\"请完成此方法\")\n", pyType(m.Ret))
			}
			return sb.String()
		}
		fn := sig.Fn
		if sig.PythonFn != "" {
			fn = sig.PythonFn
		}
		var ps strings.Builder
		for i, t := range sig.Params {
			fmt.Fprintf(&ps, ", %s: %s", parameterNames[i], pyType(t))
		}
		return header + fmt.Sprintf("class Solution:\n    def %s(self%s) -> %s:\n        # 在这里编写解法\n        raise NotImplementedError(\"请完成解法\")\n", fn, ps.String(), pyType(sig.Ret))
	}

	typed := lang == "typescript"
	formatParams := func(ps, ns []string) string {
		parts := make([]string, len(ps))
		for i, t := range ps {
			if typed {
				parts[i] = ns[i] + ": " + tsType(t)
			} else {
				parts[i] = ns[i]
			}
		}
		return strings.Join(parts, ", ")
	}
	if sig.Cls != "" {
		var sb strings.Builder
		fmt.Fprintf(&sb, "// ListNode、TreeNode、_Node 由测试环境提供。\nclass %s {\n  constructor(%s) {\n    // 初始化数据结构\n  }\n", sig.Cls, formatParams(sig.Ctor, ctorNames))
		for _, m := range sig.Methods {
			ns := methodArgNames(sig.Cls, m.Name, m.Params, methodNames)
			retAnn := ""
			if typed {
				retAnn = ": " + tsType(m.Ret)
			}
			fmt.Fprintf(&sb, "\n  %s(%s)%s {\n    throw new Error(\"请完成此方法\");\n  }\n", m.Name, formatParams(m.Params, ns), retAnn)
		}
		sb.WriteString("}\n")
		return sb.String()
	}
	retAnn := ""
	if typed {
		retAnn = ": " + tsType(sig.Ret)
	}
	return fmt.Sprintf("// ListNode、TreeNode、_Node 由测试环境提供。\nfunction %s(%s)%s {\n  // 在这里编写解法\n  throw new Error(\"请完成解法\");\n}\n", sig.Fn, formatParams(sig.Params, parameterNames), retAnn)
}

func pythonPrelude(sig RawSignature) string {
	sigBytes, _ := MarshalJSONNoEscape(sig)
	sigPy := string(sigBytes)
	sigPy = reWordNull.ReplaceAllString(sigPy, "None")
	sigPy = reWordTrue.ReplaceAllString(sigPy, "True")
	sigPy = reWordFalse.ReplaceAllString(sigPy, "False")
	return `import sys

# 数组、链表和树在 solve 中均使用题面规定的值序列。
_SIGNATURE = ` + sigPy + `
_lines = sys.stdin.read().replace("\r", "").split("\n")
_line = 0

def _item(t):
    return t[:-2] if t.endswith("[]") else t[5:-1] if t.startswith("List<") else None

def _atom(s, t):
    if t in ("string", "char"):
        return s
    if t == "bool":
        return s in ("true", "1")
    if s == "null" or (t == "NodeIndex" and s == "-1"):
        return None
    return float(s) if t == "double" else int(s)

def _next():
    global _line
    result = _lines[_line]
    _line += 1
    return result

def _read(t):
    if t == "ListNode":
        return _read("int[]")
    if t == "TreeNode":
        return _read("nullable-int[]")
    if t in ("CycleList", "JoinList"):
        return [_read("int[]"), _read("int")]
    if t == "RandomList":
        result = []
        for _ in range(int(_next())):
            value, random = map(int, _next().split())
            result.append([value, None if random == -1 else random])
        return result
    item = _item(t)
    if item is None:
        return _atom(_next(), t)
    count = int(_next())
    if item in ("int", "long", "double", "bool", "char", "nullable-int"):
        tokens = []
        while len(tokens) < count:
            tokens.extend(_next().split())
        return [_atom(s, item) for s in tokens]
    return [_read(item) for _ in range(count)]

def _text(v, t=""):
    if v is None:
        return "-1" if t == "NodeIndex" else "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    return str(v)

def _format(v, t):
    if t == "ListNode":
        return _format(v or [], "int[]")
    if t == "TreeNode":
        return _format(v or [], "nullable-int[]")
    if t == "RandomList":
        return [str(len(v))] + [str(x) + " " + str(-1 if r is None else r) for x, r in v]
    item = _item(t)
    if item:
        if item in ("int", "long", "double", "bool", "char", "nullable-int"):
            return [str(len(v))] + ([" ".join(_text(x) for x in v)] if v else [])
        return [str(len(v))] + [line for x in v for line in _format(x, item)]
    return [_text(v, t)]
`
}

func pythonEpilogue(sig RawSignature) string {
	if sig.Cls != "" {
		return "\noperations, arguments = [], []\nfor i in range(int(_next())):\n    name, *values = _next().split()\n    types = _SIGNATURE[\"ctor\"] if i == 0 else _SIGNATURE[\"methods\"][name][0]\n    operations.append(name)\n    arguments.append([_atom(v, t) for v, t in zip(values, types)])\nanswer = solve(operations, arguments)\nsys.stdout.write(\"\\n\".join(_text(v) for v in answer) + \"\\n\")\n"
	}
	outBytes, _ := MarshalJSONNoEscape(rawOutType(sig))
	return fmt.Sprintf("\narguments = [_read(t) for t in _SIGNATURE[\"params\"]]\nanswer = solve(*arguments)\nsys.stdout.write(\"\\n\".join(_format(answer, %s)) + \"\\n\")\n", string(outBytes))
}

func javascriptPrelude(sig RawSignature) string {
	sigBytes, _ := MarshalJSONNoEscape(sig)
	return `// 标准输入工具；数组、链表和树在 solve 中均使用题面规定的值序列。
const __signature = ` + string(sigBytes) + `;
const __lines = require("fs").readFileSync(0, "utf8").replace(/\r/g, "").split("\n");
let __line = 0;
function __item(t) { return t.endsWith("[]") ? t.slice(0, -2) : /^List<(.+)>$/.exec(t)?.[1]; }
function __atom(s, t) {
  if (t === "string" || t === "char") return s;
  if (t === "bool") return s === "true" || s === "1";
  if (s === "null" || (t === "NodeIndex" && s === "-1")) return null;
  return Number(s);
}
function __read(t) {
  if (t === "ListNode") return __read("int[]");
  if (t === "TreeNode") return __read("nullable-int[]");
  if (t === "CycleList" || t === "JoinList") return [__read("int[]"), __read("int")];
  if (t === "RandomList") { const n = Number(__lines[__line++]); return Array.from({ length: n }, () => { const [v, r] = __lines[__line++].trim().split(/\s+/).map(Number); return [v, r === -1 ? null : r]; }); }
  const item = __item(t);
  if (!item) return __atom(__lines[__line++], t);
  const n = Number(__lines[__line++]);
  if (["int", "long", "double", "bool", "char", "nullable-int"].includes(item)) {
    const tokens = [];
    while (tokens.length < n) tokens.push(...__lines[__line++].trim().split(/\s+/).filter(Boolean));
    return tokens.map(s => __atom(s, item));
  }
  return Array.from({ length: n }, () => __read(item));
}
function __format(v, t) {
  if (t === "ListNode") return __format(v || [], "int[]");
  if (t === "TreeNode") return __format(v || [], "nullable-int[]");
  if (t === "RandomList") return [String(v.length), ...v.map(([x, r]) => x + " " + (r == null ? -1 : r))];
  const item = __item(t);
  if (item) {
    if (["int", "long", "double", "bool", "char", "nullable-int"].includes(item)) return [String(v.length), ...(v.length ? [v.map(x => x == null ? "null" : String(x)).join(" ")] : [])];
    return [String(v.length), ...v.flatMap(x => __format(x, item))];
  }
  return [v == null ? (t === "NodeIndex" ? "-1" : "null") : String(v)];
}
`
}

func javascriptEpilogue(sig RawSignature) string {
	if sig.Cls != "" {
		return "\nconst operations = [], argumentsList = [];\nconst count = Number(__lines[__line++]);\nfor (let i = 0; i < count; i++) {\n  const [name, ...args] = __lines[__line++].trim().split(/\\s+/);\n  const types = i === 0 ? __signature.ctor : __signature.methods[name][0];\n  operations.push(name);\n  argumentsList.push(args.map((v, j) => __atom(v, types[j])));\n}\nconst answer = solve(operations, argumentsList);\nconsole.log(answer.map(v => v == null ? \"null\" : String(v)).join(\"\\n\"));\n"
	}
	outBytes, _ := MarshalJSONNoEscape(rawOutType(sig))
	return fmt.Sprintf("\nconst args = __signature.params.map(__read);\nconst answer = solve(...args);\nconsole.log(__format(answer, %s).join(\"\\n\"));\n", string(outBytes))
}

// LegacyAcmTemplate matches templates.cjs `legacyAcmTemplate` for draft migration hashes.
func LegacyAcmTemplate(sig RawSignature, parameterNames []string, lang string) string {
	names := parameterNames
	if sig.Cls != "" {
		names = []string{"operations", "arguments"}
	}
	voidNote := ""
	if sig.Ret == "void" {
		voidNote = "（返回修改后的序列或矩阵）"
	}
	if lang == "python" {
		return fmt.Sprintf("# 编写 solve；下方已提供标准输入输出，可直接修改。\ndef solve(%s):\n    # 返回题面要求的结果%s\n    raise NotImplementedError(\"请完成解法\")\n\n", strings.Join(names, ", "), voidNote) +
			pythonPrelude(sig) + pythonEpilogue(sig)
	}
	typed := lang == "typescript"
	argList := make([]string, len(names))
	for i, n := range names {
		if n == "arguments" {
			n = "argumentsList"
		}
		if typed {
			n += ": any"
		}
		argList[i] = n
	}
	retAnn := ""
	prefix := ""
	if typed {
		retAnn = ": any"
		prefix = "// @ts-nocheck\n"
	}
	solve := fmt.Sprintf("// 编写 solve；下方已提供标准输入输出，可直接修改。\nfunction solve(%s)%s {\n  // 返回题面要求的结果%s\n  throw new Error(\"请完成解法\");\n}\n\n", strings.Join(argList, ", "), retAnn, voidNote)
	return prefix + solve + javascriptPrelude(sig) + javascriptEpilogue(sig)
}

// PreviousAcmTemplate matches templates.cjs `previousAcmTemplate`.
func PreviousAcmTemplate(lang string) string {
	if lang == "python" {
		return "import sys\n\ndef main():\n    # 从 sys.stdin 读取输入，使用 print 输出答案\n    pass\n\nif __name__ == \"__main__\":\n    main()\n"
	}
	ann := ""
	if lang == "typescript" {
		ann = ": string"
	}
	return fmt.Sprintf("const fs = require(\"fs\");\nconst input%s = fs.readFileSync(0, \"utf8\");\n\n// 按题面解析 input，在这里编写解法\n// 使用 console.log 输出答案\n", ann)
}

const (
	dartList = "/**\n * Definition for singly-linked list.\n * class ListNode {\n *   int val;\n *   ListNode? next;\n *   ListNode([this.val = 0, this.next]);\n * }\n */\n"
	dartTree = "/**\n * Definition for a binary tree node.\n * class TreeNode {\n *   int val;\n *   TreeNode? left;\n *   TreeNode? right;\n *   TreeNode([this.val = 0, this.left, this.right]);\n * }\n */\n"
)

func rustUnavailableComment(why string) string {
	return "// 力扣没有这道题的 Rust 版本：" + why + "，\n// Rust 的 Option<Box<ListNode>> 表示不了。可以切到 ACM 模式用 Rust 写，或者换一种语言。\n"
}

var rustWhy = map[int]string{
	138: "每个节点还有一个可以指向任意节点的 random 指针",
	141: "链表的最后一个节点可能接回前面的节点，成环",
	142: "链表的最后一个节点可能接回前面的节点，成环",
	160: "两条链表从某个节点开始共用后面的节点",
}

var authoredStarters = map[int]map[string]string{
	138: {
		"dart": "/**\n * Definition for a Node.\n * class Node {\n *   int val;\n *   Node? next;\n *   Node? random;\n *   Node([this.val = 0, this.next, this.random]);\n * }\n */\nclass Solution {\n  Node? copyRandomList(Node? head) {\n    \n  }\n}",
		"rust": rustUnavailableComment(rustWhy[138]),
	},
	141: {
		"dart": dartList + "class Solution {\n  bool hasCycle(ListNode? head) {\n    \n  }\n}",
		"rust": rustUnavailableComment(rustWhy[141]),
	},
	142: {
		"dart": dartList + "class Solution {\n  ListNode? detectCycle(ListNode? head) {\n    \n  }\n}",
		"rust": rustUnavailableComment(rustWhy[142]),
	},
	160: {
		"dart": dartList + "class Solution {\n  ListNode? getIntersectionNode(ListNode? headA, ListNode? headB) {\n    \n  }\n}",
		"rust": rustUnavailableComment(rustWhy[160]),
	},
	236: {
		"dart": dartTree + "class Solution {\n  TreeNode? lowestCommonAncestor(TreeNode? root, TreeNode? p, TreeNode? q) {\n    \n  }\n}",
	},
	240: {
		"dart": "class Solution {\n  bool searchMatrix(List<List<int>> matrix, int target) {\n    \n  }\n}",
	},
}

// LeetcodeUnavailable returns the map of languages that are unsupported in LeetCode mode for problem id, or nil.
func LeetcodeUnavailable(id int) map[string]string {
	why, ok := rustWhy[id]
	if !ok {
		return nil
	}
	return map[string]string{
		"rust": fmt.Sprintf("力扣没有这道题的 Rust 版本：%s，Option<Box<ListNode>> 表示不了。可以切到 ACM 模式用 Rust 写", why),
	}
}

// CloudStarter looks up a cloud-language starter template and validates that all expected function/method symbols exist.
func CloudStarter(id int, sig RawSignature, lang string, leetcodeStarters map[string]map[string]string) (string, error) {
	idKey := fmt.Sprintf("%d", id)
	code, ok := leetcodeStarters[idKey][lang]
	if !ok {
		code, ok = authoredStarters[id][lang]
	}
	if !ok {
		return "", fmt.Errorf("%d: 没有 %s 的起始代码（tools/practice/leetcode-starters.json 或 authoredStarters）", id, lang)
	}
	if unavail := LeetcodeUnavailable(id); unavail != nil && unavail[lang] != "" {
		return code, nil
	}
	var names []string
	if sig.Cls != "" {
		if lang == "c" {
			names = append(names, LCFirst(sig.Cls)+"Create", LCFirst(sig.Cls)+"Free")
		}
		for _, m := range sig.Methods {
			names = append(names, MethodName(lang, sig.Cls, m.Name))
		}
	} else {
		names = []string{FnName(lang, sig.Fn)}
	}
	for _, n := range names {
		re := regexp.MustCompile(`\b` + regexp.QuoteMeta(n) + `\s*\(`)
		if !re.MatchString(code) {
			return "", fmt.Errorf("%d %s：起始代码里没有 %s(…)，判题程序会找不到它", id, lang, n)
		}
	}
	return code, nil
}

func formatAcmType(t string, isOutput bool) (string, error) {
	if array, ok := sigItemType(t); ok {
		nested := strings.HasSuffix(array, "[]") || strings.HasPrefix(array, "List<") || array == "ListNode"
		if nested {
			inner, err := formatAcmType(array, isOutput)
			if err != nil {
				return "", err
			}
			return "先一行外层序列的长度 r；之后依次给出 r 个子序列，每个子序列按以下规则独立编码：" + inner, nil
		}
		if array == "string" {
			return "先一行字符串数量 n，之后 n 行每行一个字符串，不加引号；空字符串占一空行，n = 0 时没有字符串行", nil
		}
		inner, err := formatAcmType(array, isOutput)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("先一行元素个数 n；n > 0 时下一行给出 n 个空格分隔的%s，n = 0 时没有元素行", inner), nil
	}
	switch t {
	case "int", "long":
		return "整数", nil
	case "double":
		return "实数", nil
	case "bool":
		return "布尔值 true 或 false", nil
	case "string":
		return "字符串（占完整一行，不加引号，空串用空行）", nil
	case "char":
		return "字符", nil
	case "TreeRef":
		return "树中已有节点的值", nil
	case "NodeIndex":
		return "节点下标（从 0 开始，无节点时为 -1）", nil
	case "TreeVal":
		return "节点值（无节点时为 null）", nil
	case "ListNode":
		return "节点值序列：先一行节点数 n；n > 0 时下一行给出 n 个空格分隔的整数，n = 0 时没有元素行", nil
	case "TreeNode":
		return "二叉树层序序列：先一行序列长度 n；n > 0 时下一行给出 n 个空格分隔的节点值或 null。按队列从左到右分配每个非空节点的左右孩子，末尾多余 null 可省略；空树写 0", nil
	case "CycleList":
		return "先读节点值序列（节点数 n 一行，n > 0 时下一行 n 个整数），再读一行 pos；尾节点指向下标 pos，pos = -1 表示不成环", nil
	case "JoinList":
		return "第二条链表的独有前缀：先读前缀节点数 n，n > 0 时下一行 n 个整数；再一行给出共享后缀在第一条链表中的起点下标 k，k = -1 表示不相交", nil
	case "RandomList":
		return "先一行节点数 n，之后 n 行每行两个整数 val randomIndex；randomIndex 从 0 开始，-1 表示 random 为空，next 按输入次序连接", nil
	default:
		return "", fmt.Errorf("undocumented ACM type: %s", t)
	}
}

// BuildAcmStatement constructs the `acm` section of tools/practice/data/<pad4>.json identically to build.cjs.
func BuildAcmStatement(
	id int,
	sig RawSignature,
	names []string,
	examples []PracticeCase,
	methodNames map[string][]string,
	description string,
	constraints []string,
	unorderedSet map[int]bool,
) (PracticeACM, error) {
	notes := make([]string, 0, 2+len(constraints)+4)
	notes = append(notes, "每次运行只处理一组数据，不需要读取测试组数 T。")
	notes = append(notes, constraints...)

	var input, outputText string
	if sig.Cls != "" {
		var ctorSb strings.Builder
		for i := range sig.Ctor {
			if sig.Cls == "LRUCache" {
				ctorSb.WriteString(" capacity")
			} else {
				fmt.Fprintf(&ctorSb, " arg%d", i+1)
			}
		}
		var methodLines []string
		for _, m := range sig.Methods {
			var line strings.Builder
			line.WriteString(m.Name)
			ns := methodNames[m.Name]
			for i := range m.Params {
				arg := fmt.Sprintf("arg%d", i+1)
				if i < len(ns) && ns[i] != "" {
					arg = ns[i]
				}
				line.WriteByte(' ')
				line.WriteString(arg)
			}
			methodLines = append(methodLines, line.String())
		}
		input = fmt.Sprintf("第一行输入操作数 q，之后 q 行每行一个操作。第一条必须是构造操作 %s%s。其余操作为：\n%s\n参数与操作名使用空格分隔，字符串不加引号。", sig.Cls, ctorSb.String(), strings.Join(methodLines, "\n"))
		outputText = "输出 q 行，与输入操作一一对应。构造操作和没有返回值的操作输出 null；查询操作输出查询结果，布尔值写 true 或 false。"
	} else {
		var inLines []string
		for i, t := range sig.Params {
			ft, err := formatAcmType(t, false)
			if err != nil {
				return PracticeACM{}, err
			}
			inLines = append(inLines, fmt.Sprintf("%d. %s：%s。", i+1, names[i], ft))
		}
		input = "依次读取以下参数，各参数从新的一行开始：\n" + strings.Join(inLines, "\n")
		ret := rawOutType(sig)
		ftRet, err := formatAcmType(ret, true)
		if err != nil {
			return PracticeACM{}, err
		}
		prefix := "输出题目要求的结果。"
		if sig.Ret == "void" {
			outIdx := 0
			if sig.Out != nil {
				outIdx = *sig.Out
			}
			prefix = fmt.Sprintf("输出修改后的 %s。", names[outIdx])
		}
		outputText = fmt.Sprintf("%s格式为：%s。", prefix, ftRet)

		if sig.Ret == "void" {
			notes = append(notes, "LeetCode 模式检查原参数的修改结果；ACM 模式请将最终结果按输出格式写到标准输出。")
		}
		if id == 108 {
			notes = append(notes, "答案不唯一，任意节点值正确且高度平衡的二叉搜索树都可通过。")
		}
		if id == 5 || id == 76 {
			notes = append(notes, "最优子串可能不唯一，测试会验证子串合法性及最优长度。")
		}
		if unorderedSet[id] {
			switch id {
			case 131:
				notes = append(notes, "分割方案之间的顺序不限，同一方案内片段顺序必须保持不变。")
			case 46, 51:
				notes = append(notes, "完整方案之间的输出顺序不限，每个方案内部的排列或棋盘行次序必须正确。")
			default:
				notes = append(notes, "输出集合的排列顺序不限，不得遗漏或重复答案。")
			}
		}
		hasNodeParam := false
		for _, t := range sig.Params {
			if reNodeType.MatchString(t) {
				hasNodeParam = true
				break
			}
		}
		if hasNodeParam {
			notes = append(notes, "ACM 使用上述序列格式表示链表或二叉树，程序需自行读取输入并处理这些结构。LeetCode 模式由测试环境建立节点。")
		}
	}

	acmExamples := make([]PracticeACMExample, len(examples))
	for i, c := range examples {
		acmExamples[i] = PracticeACMExample{
			Input:       c.Stdin,
			Output:      c.Stdout,
			Explanation: fmt.Sprintf("%s：由原题对应示例改写，所有序列长度和节点下标均按上述格式编码。", c.Label),
		}
	}
	return PracticeACM{
		Description: description,
		Input:       input,
		Output:      outputText,
		Notes:       notes,
		Examples:    acmExamples,
	}, nil
}
