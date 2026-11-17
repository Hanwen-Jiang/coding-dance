"""Independent, read-only audit of displayed examples against checked-in statements."""
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class PreBlocks(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth, self.current, self.blocks, self.target = 0, [], [], None

    def handle_starttag(self, tag, attrs):
        classes = dict(attrs).get("class", "")
        if not self.depth and (tag == "pre" or (tag == "div" and "example-block" in classes.split())):
            self.target = tag
            self.depth += 1
        elif self.depth and tag == self.target:
            self.depth += 1
        if self.depth and tag in ("br", "p"):
            self.current.append("\n")

    def handle_endtag(self, tag):
        if tag == self.target and self.depth:
            self.depth -= 1
            if not self.depth:
                self.blocks.append("".join(self.current))
                self.current = []
                self.target = None

    def handle_data(self, data):
        if self.depth:
            self.current.append(data)


def compact(text):
    return re.sub(r"\s+", "", text)


problem_count = example_count = 0
for file in sorted((ROOT / "tools/practice/data").glob("[0-9][0-9][0-9][0-9].json")):
    problem = json.loads(file.read_text(encoding="utf-8"))
    examples = problem.get("examples")
    assert examples, f'{problem["id"]}: no official examples'
    document = next((ROOT / "problems").glob(f'{problem["id"]:04d}.*.md'))
    parser = PreBlocks()
    parser.feed(document.read_text(encoding="utf-8").split("## 思路图解")[0])
    blocks = [block for block in parser.blocks if "输入" in block and "输出" in block]
    assert len(examples) == len(blocks), f'{problem["id"]}: {len(examples)} displayed examples versus {len(blocks)} statement examples'
    for index, (example, block) in enumerate(zip(examples, blocks), 1):
        source = example.get("source")
        assert source, f'{problem["id"]}/{index}: missing source provenance'
        assert source["index"] == index, f'{problem["id"]}: official example ordering changed'
        assert (ROOT / source["path"]).resolve() == document.resolve(), f'{problem["id"]}/{index}: source document mismatch'
        assert compact(source["input"]) in compact(block), f'{problem["id"]}/{index}: input does not occur in its statement example'
        assert compact(source["output"]) in compact(block), f'{problem["id"]}/{index}: output does not occur in its statement example'
        assert any(case["input"] == example["input"] for case in problem["cases"]), f'{problem["id"]}/{index}: official input absent from full tests'
        example_count += 1
    problem_count += 1
assert problem_count == 100
print(f"Official example provenance audited: {problem_count} problems, {example_count} examples, original statement order and source text preserved.")
