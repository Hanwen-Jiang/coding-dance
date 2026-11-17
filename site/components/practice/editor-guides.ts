import { getIndentUnit, indentUnit, syntaxTree } from "@codemirror/language";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";

/** Paint only existing indentation, without inserting characters or widgets. */
function decorations(view: EditorView): DecorationSet {
  const doc = view.state.doc, step = Math.max(1, getIndentUnit(view.state));
  const ranges: ReturnType<Decoration["range"]>[] = [];
  const columns = (text: string) => {
    let count = 0;
    for (const char of text) {
      if (char === " ") count++;
      else if (char === "\t") count += view.state.tabSize - count % view.state.tabSize;
      else break;
    }
    return count;
  };
  const neighboringIndent = (lineNumber: number, direction: number) => {
    for (let number = lineNumber + direction, scanned = 0; number > 0 && number <= doc.lines && scanned < 200; number += direction, scanned++) {
      const text = doc.line(number).text;
      if (text.trim()) return columns(text) + (direction < 0 && /:\s*(?:#.*)?$/.test(text) ? step : 0);
    }
    return 0;
  };
  const painted = new Set<number>();
  for (const visible of view.visibleRanges) {
    for (let position = doc.lineAt(visible.from).from; position <= visible.to;) {
      const line = doc.lineAt(position);
      if (!painted.has(line.number)) {
        painted.add(line.number);
        const indent = line.text.trim() ? columns(line.text) : Math.min(neighboringIndent(line.number, -1), neighboringIndent(line.number, 1));
        const depth = Math.min(32, Math.floor(indent / step));
        if (depth) ranges.push(Decoration.line({ attributes: {
          class: "cm-indent-guides",
          "data-indent-depth": String(depth),
          style: `background-image:${Array(depth).fill("linear-gradient(var(--practice-indent-guide),var(--practice-indent-guide))").join(",")};background-position:${Array.from({ length: depth }, (_, level) => `${level * step}ch 0`).join(",")};background-size:1px 100%;background-repeat:no-repeat`,
        } }).range(line.from));
      }
      if (line.to === doc.length) break;
      position = line.to + 1;
    }
    // Python's parser already distinguishes function definitions/calls. Keep
    // conventional constructor calls such as ListNode() in the class color.
    syntaxTree(view.state).iterate({ from: visible.from, to: visible.to, enter(node) {
      if (node.name === "VariableName" && node.node.parent?.name === "CallExpression" && /^[A-Z]/.test(doc.sliceString(node.from, node.to))) {
        ranges.push(Decoration.mark({ class: "cm-class-reference" }).range(node.from, node.to));
      }
    } });
  }
  return Decoration.set(ranges, true);
}

export const practiceIndentGuides = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = decorations(view); }
  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state) || update.startState.facet(indentUnit) !== update.state.facet(indentUnit) || update.startState.tabSize !== update.state.tabSize) {
      this.decorations = decorations(update.view);
    }
  }
}, { decorations: (plugin) => plugin.decorations });
