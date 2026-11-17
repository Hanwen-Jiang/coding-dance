"""Extract the actual examples in every checked-in official problem statement.

HTML is parsed before values are read with ast.literal_eval. No problem text is executed.
The two pointer-identity encodings are deliberately mapped by the JS generator.
"""
import ast
import html.parser
import json
import pathlib
import re
import sys


class Text(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in ("p", "div", "pre", "li", "br"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("p", "div", "pre", "li"):
            self.parts.append("\n")

    def handle_data(self, data):
        self.parts.append(data)


def split_values(value):
    """Split only top-level commas/newlines, keeping quoted strings and nested arrays intact."""
    result, depth, quote, escape, start = [], 0, None, False, 0
    for i, ch in enumerate(value):
        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
        elif ch in ("'", '"'):
            quote = ch
        elif ch in "[({":
            depth += 1
        elif ch in "])}":
            depth -= 1
        elif depth == 0 and ch in ",\n":
            if value[start:i].strip():
                result.append(value[start:i].strip())
            start = i + 1
    if value[start:].strip():
        result.append(value[start:].strip())
    return result


def literal(value):
    # Replace JSON literal names through the AST, never inside a quoted string.
    tree = ast.parse(value.strip(), mode="eval")

    class Literals(ast.NodeTransformer):
        def visit_Name(self, node):
            if node.id in ("null", "true", "false"):
                return ast.copy_location(ast.Constant({"null": None, "true": True, "false": False}[node.id]), node)
            return node

    return ast.literal_eval(Literals().visit(tree))


def inputs(raw):
    fields, positional, ordered = {}, [], []
    for part in split_values(raw):
        m = re.match(r"^(\w+)\s*=\s*([\s\S]*)$", part)
        if m:
            fields[m[1]] = literal(m[2])
            ordered.append(fields[m[1]])
        else:
            positional.append(literal(part))
            ordered.append(positional[-1])
    return {"fields": fields, "positional": positional, "values": ordered}


root = pathlib.Path(__file__).resolve().parents[2]
result = {}
for path in sorted((root / "problems").glob("*.md")):
    source = path.read_text(encoding="utf-8").split("## 题目描述", 1)[1].split("## 思路图解", 1)[0]
    parser = Text()
    parser.feed(source)
    text = "".join(parser.parts).replace("\r", "").replace("\u00a0", " ")
    headings = list(re.finditer(r"(?:^|\n)\s*示例\s*(\d*)\s*[:：]\s*", text))
    examples = []
    for i, heading in enumerate(headings):
        section = text[heading.end():headings[i + 1].start() if i + 1 < len(headings) else len(text)]
        match = re.search(r"输入\s*[:：]?\s*([\s\S]*?)输出\s*[:：]?\s*([\s\S]*)", section)
        if not match:
            raise ValueError(f"{path.name} example {heading[1]} has no input/output")
        raw_input = match[1].strip()
        raw_output = re.split(r"(?:^|\n)\s*(?:解释|说明|提示|进阶)\s*(?:[:：]|\n)", match[2], 1)[0].strip()
        example = {"index": int(heading[1] or i + 1), "path": "problems/" + path.name, "inputText": raw_input, "outputText": raw_output, **inputs(raw_input)}
        try:
            example["outputValue"] = literal(raw_output)
            example["hasOutputValue"] = True
        except (ValueError, SyntaxError):
            example["hasOutputValue"] = False
        examples.append(example)
    if not examples:
        raise ValueError(f"No official examples found: {path.name}")
    result[str(int(path.name.split(".")[0]))] = examples
json.dump(result, sys.stdout, ensure_ascii=False)
