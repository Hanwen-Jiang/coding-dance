package builder

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"slices"
	"sort"
	"strings"
)

// MethodSpec represents a design-class method in declaration order: "name": [[params...], ret].
type MethodSpec struct {
	Name   string
	Params []string
	Ret    string
}

// OrderedMethods preserves JSON object property order from cases/specs so generated starters match templates.cjs byte-for-byte.
type OrderedMethods []MethodSpec

func (om *OrderedMethods) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	tok, err := dec.Token()
	if err != nil {
		return err
	}
	if tok == nil {
		*om = nil
		return nil
	}
	delim, ok := tok.(json.Delim)
	if !ok || delim != '{' {
		return fmt.Errorf("methods must be a JSON object")
	}
	var out []MethodSpec
	for dec.More() {
		kTok, err := dec.Token()
		if err != nil {
			return err
		}
		name, _ := kTok.(string)
		var pair []json.RawMessage
		if err := dec.Decode(&pair); err != nil {
			return err
		}
		if len(pair) != 2 {
			return fmt.Errorf("method %s must have [params, ret]", name)
		}
		var params []string
		if err := json.Unmarshal(pair[0], &params); err != nil {
			return err
		}
		if params == nil {
			params = []string{}
		}
		var ret string
		if err := json.Unmarshal(pair[1], &ret); err != nil {
			return err
		}
		out = append(out, MethodSpec{Name: name, Params: params, Ret: ret})
	}
	_, _ = dec.Token() // consume '}'
	*om = out
	return nil
}

func (om OrderedMethods) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteByte('{')
	for i, m := range om {
		if i > 0 {
			buf.WriteByte(',')
		}
		kb, _ := MarshalJSONNoEscape(m.Name)
		buf.Write(kb)
		buf.WriteByte(':')
		params := m.Params
		if params == nil {
			params = []string{}
		}
		pb, _ := MarshalJSONNoEscape([]any{params, m.Ret})
		buf.Write(pb)
	}
	buf.WriteByte('}')
	return buf.Bytes(), nil
}

func (om OrderedMethods) Lookup(name string) (MethodSpec, bool) {
	for _, m := range om {
		if m.Name == name {
			return m, true
		}
	}
	return MethodSpec{}, false
}

// RawSignature mirrors JS signature objects in exact field order for byte-identical starter hashes.
type RawSignature struct {
	Fn            string            `json:"fn,omitempty"`
	Params        []string          `json:"params,omitempty"`
	Ret           string            `json:"ret,omitempty"`
	Out           *int              `json:"out,omitempty"`
	Cls           string            `json:"cls,omitempty"`
	Ctor          []string          `json:"ctor,omitempty"`
	Methods       OrderedMethods    `json:"methods,omitempty"`
	Cmp           string            `json:"cmp,omitempty"`
	PythonFn      string            `json:"pythonFn,omitempty"`
	PythonMethods map[string]string `json:"pythonMethods,omitempty"`
}

func (s RawSignature) Clone() RawSignature {
	out := s
	if s.Params != nil {
		out.Params = append([]string(nil), s.Params...)
	}
	if s.Out != nil {
		v := *s.Out
		out.Out = &v
	}
	if s.Ctor != nil {
		out.Ctor = append([]string(nil), s.Ctor...)
	}
	if s.Methods != nil {
		out.Methods = make(OrderedMethods, len(s.Methods))
		for i, m := range s.Methods {
			out.Methods[i] = MethodSpec{Name: m.Name, Params: append([]string(nil), m.Params...), Ret: m.Ret}
		}
	}
	if s.PythonMethods != nil {
		out.PythonMethods = make(map[string]string, len(s.PythonMethods))
		for k, v := range s.PythonMethods {
			out.PythonMethods[k] = v
		}
	}
	return out
}

func (s RawSignature) MarshalJSON() ([]byte, error) {
	var parts []string
	addKV := func(k string, v any) {
		kb, _ := MarshalJSONNoEscape(k)
		vb, _ := MarshalJSONNoEscape(v)
		parts = append(parts, string(kb)+":"+string(vb))
	}
	if s.Cls != "" {
		addKV("cls", s.Cls)
		ctor := s.Ctor
		if ctor == nil {
			ctor = []string{}
		}
		addKV("ctor", ctor)
		addKV("methods", s.Methods)
		if s.Cmp != "" {
			addKV("cmp", s.Cmp)
		}
		if len(s.PythonMethods) > 0 {
			addKV("pythonMethods", s.PythonMethods)
		}
	} else {
		addKV("fn", s.Fn)
		params := s.Params
		if params == nil {
			params = []string{}
		}
		addKV("params", params)
		addKV("ret", s.Ret)
		if s.Out != nil {
			addKV("out", *s.Out)
		}
		if s.Cmp != "" {
			addKV("cmp", s.Cmp)
		}
		if s.PythonFn != "" {
			addKV("pythonFn", s.PythonFn)
		}
		if len(s.PythonMethods) > 0 {
			addKV("pythonMethods", s.PythonMethods)
		}
	}
	return []byte("{" + strings.Join(parts, ",") + "}"), nil
}

var validJudgeBaseTypes = []string{
	"int", "long", "double", "bool", "string", "char", "ListNode", "TreeNode", "void",
	"CycleList", "JoinList", "NodeIndex", "TreeRef", "TreeVal", "RandomList",
}

type NormType struct {
	Arr  *NormType
	List bool
	Base string
	Src  string
}

func ParseJudgeType(s string) (NormType, error) {
	s = strings.TrimSpace(s)
	if strings.HasSuffix(s, "[]") {
		inner, err := ParseJudgeType(s[:len(s)-2])
		if err != nil {
			return NormType{}, err
		}
		return NormType{Arr: &inner, List: false, Src: s}, nil
	}
	if strings.HasPrefix(s, "List<") && strings.HasSuffix(s, ">") {
		inner, err := ParseJudgeType(s[5 : len(s)-1])
		if err != nil {
			return NormType{}, err
		}
		return NormType{Arr: &inner, List: true, Src: s}, nil
	}
	if !slices.Contains(validJudgeBaseTypes, s) {
		return NormType{}, fmt.Errorf("不认识的类型：%s", s)
	}
	return NormType{Base: s, Src: s}, nil
}

type NormMethod struct {
	Name   string
	Params []NormType
	Ret    NormType
}

type NormSignature struct {
	Kind    string // "fn" | "design"
	Fn      string
	Params  []NormType
	Ret     NormType
	Out     *int
	Cls     string
	Ctor    []NormType
	Methods []NormMethod
	Cmp     string
}

func (n NormSignature) Method(name string) (NormMethod, bool) {
	for _, m := range n.Methods {
		if m.Name == name {
			return m, true
		}
	}
	return NormMethod{}, false
}

func NormSig(sig RawSignature) (NormSignature, error) {
	if sig.Cls != "" {
		var ctor []NormType
		for _, c := range sig.Ctor {
			t, err := ParseJudgeType(c)
			if err != nil {
				return NormSignature{}, err
			}
			ctor = append(ctor, t)
		}
		var methods []NormMethod
		for _, m := range sig.Methods {
			var ps []NormType
			for _, p := range m.Params {
				t, err := ParseJudgeType(p)
				if err != nil {
					return NormSignature{}, err
				}
				ps = append(ps, t)
			}
			rt, err := ParseJudgeType(m.Ret)
			if err != nil {
				return NormSignature{}, err
			}
			methods = append(methods, NormMethod{Name: m.Name, Params: ps, Ret: rt})
		}
		return NormSignature{Kind: "design", Cls: sig.Cls, Ctor: ctor, Methods: methods, Cmp: sig.Cmp}, nil
	}
	var params []NormType
	for _, p := range sig.Params {
		t, err := ParseJudgeType(p)
		if err != nil {
			return NormSignature{}, err
		}
		params = append(params, t)
	}
	rt, err := ParseJudgeType(sig.Ret)
	if err != nil {
		return NormSignature{}, err
	}
	var outIdx *int
	if rt.Base == "void" {
		v := 0
		if sig.Out != nil {
			v = *sig.Out
		}
		outIdx = &v
	}
	return NormSignature{Kind: "fn", Fn: sig.Fn, Params: params, Ret: rt, Out: outIdx, Cmp: sig.Cmp}, nil
}

func UsesType(sig NormSignature, base string) bool {
	if sig.Kind == "design" {
		for _, c := range sig.Ctor {
			if c.Base == base {
				return true
			}
		}
		for _, m := range sig.Methods {
			for _, p := range m.Params {
				if p.Base == base {
					return true
				}
			}
			if m.Ret.Base == base {
				return true
			}
		}
		return false
	}
	for _, p := range sig.Params {
		if p.Base == base {
			return true
		}
	}
	return sig.Ret.Base == base
}

type FlatMethod struct {
	Params []string `json:"params"`
	Ret    string   `json:"ret"`
}

func FlatSigMap(sig NormSignature) map[string]any {
	if sig.Kind == "design" {
		ctor := make([]string, len(sig.Ctor))
		for i, c := range sig.Ctor {
			ctor[i] = c.Src
		}
		methods := make(map[string]FlatMethod, len(sig.Methods))
		for _, m := range sig.Methods {
			ps := make([]string, len(m.Params))
			for i, p := range m.Params {
				ps[i] = p.Src
			}
			methods[m.Name] = FlatMethod{Params: ps, Ret: m.Ret.Src}
		}
		return map[string]any{
			"kind":    "design",
			"cls":     sig.Cls,
			"ctor":    ctor,
			"methods": methods,
		}
	}
	ps := make([]string, len(sig.Params))
	for i, p := range sig.Params {
		ps[i] = p.Src
	}
	var outVal any
	if sig.Out != nil {
		outVal = *sig.Out
	}
	return map[string]any{
		"kind":   "fn",
		"fn":     sig.Fn,
		"params": ps,
		"ret":    sig.Ret.Src,
		"out":    outVal,
	}
}

func MarshalJSONNoEscape(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	b := buf.Bytes()
	return bytes.TrimSuffix(b, []byte("\n")), nil
}

func MarshalIndentNoEscape(v any, prefix, indent string) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent(prefix, indent)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func CompactJSONString(v any) string {
	b, err := MarshalJSONNoEscape(v)
	if err != nil {
		return "null"
	}
	return string(b)
}

func DecodeJSONValue(raw string) (any, error) {
	dec := json.NewDecoder(strings.NewReader(raw))
	var val any
	if err := dec.Decode(&val); err != nil {
		return nil, err
	}
	if _, err := dec.Token(); err != io.EOF {
		return nil, fmt.Errorf("trailing token")
	}
	return val, nil
}

func fillExpected(exp, got any) any {
	if es, ok := exp.([]any); ok {
		if got == nil {
			return []any{}
		}
		if gs, ok := got.([]any); ok {
			out := make([]any, len(gs))
			for i, g := range gs {
				if len(es) > 0 {
					idx := i
					if idx >= len(es) {
						idx = len(es) - 1
					}
					out[i] = fillExpected(es[idx], g)
				} else {
					out[i] = g
				}
			}
			return out
		}
	}
	return got
}

func deepSortValue(x any) any {
	arr, ok := x.([]any)
	if !ok {
		return x
	}
	out := make([]any, len(arr))
	for i, v := range arr {
		out[i] = deepSortValue(v)
	}
	sort.SliceStable(out, func(i, j int) bool {
		return CompactJSONString(out[i]) < CompactJSONString(out[j])
	})
	return out
}

func sameJSONValue(a, b any) bool {
	af, aNum := a.(float64)
	bf, bNum := b.(float64)
	if aNum && bNum {
		return math.Abs(af-bf) < 1e-5
	}
	as, aArr := a.([]any)
	bs, bArr := b.([]any)
	if aArr && bArr {
		if len(as) != len(bs) {
			return false
		}
		for i := range as {
			if !sameJSONValue(as[i], bs[i]) {
				return false
			}
		}
		return true
	}
	return CompactJSONString(a) == CompactJSONString(b)
}

// MatchesOutput mirrors tools/illustrations/judge/util.js matches(exp, got, cmp).
func MatchesOutput(exp, got any, cmp string) bool {
	if gm, ok := got.(map[string]any); ok {
		if _, hasErr := gm["__error"]; hasErr {
			return false
		}
	}
	got = fillExpected(exp, got)
	switch cmp {
	case "length":
		es, eOk := exp.([]any)
		gs, gOk := got.([]any)
		el, gl := -1, -1
		if eOk {
			el = len(es)
		}
		if gOk {
			gl = len(gs)
		}
		return gl == el
	case "unordered":
		return sameJSONValue(deepSortValue(exp), deepSortValue(got))
	default:
		return sameJSONValue(exp, got)
	}
}
