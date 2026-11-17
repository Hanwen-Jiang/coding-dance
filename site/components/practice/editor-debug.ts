// 编辑器里的调试标记：当前执行到的那一行（高亮整行）、断点（行号左边一栏，点一下加上或去掉）。
// 都是 CodeMirror 的状态字段：改代码时跟着移动；页面通过 effect 设当前行，通过回调拿到断点所在的行号。
import { Prec, RangeSet, StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, gutter, GutterMarker, keymap, lineNumbers } from "@codemirror/view";

/** 设当前执行到的行（从 1 开始；null 表示不在调试） */
export const setDebugLine = StateEffect.define<number | null>();
const toggleBreakpoint = StateEffect.define<number>(); // 参数是那一行开头的位置
const clearBreakpoints = StateEffect.define<null>();

const debugLine = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setDebugLine)) continue;
      const n = e.value;
      deco = n == null || n < 1 || n > tr.state.doc.lines ? Decoration.none : Decoration.set([Decoration.line({ class: "cm-debug-line" }).range(tr.state.doc.line(n).from)]);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

class BreakpointMarker extends GutterMarker {
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-breakpoint-dot";
    dot.setAttribute("aria-hidden", "true");
    return dot;
  }
}
const marker = new BreakpointMarker();

const breakpoints = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(set, tr) {
    set = set.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(clearBreakpoints)) set = RangeSet.empty;
      if (!e.is(toggleBreakpoint)) continue;
      let has = false;
      set.between(e.value, e.value, () => { has = true; });
      set = has ? set.update({ filter: (from) => from !== e.value }) : set.update({ add: [marker.range(e.value)] });
    }
    return set;
  },
});

/** 断点所在的行号（从 1 开始，从小到大） */
export function breakpointLines(view: EditorView) {
  const out: number[] = [];
  const iter = view.state.field(breakpoints).iter();
  for (; iter.value; iter.next()) out.push(view.state.doc.lineAt(iter.from).number);
  return [...new Set(out)];
}

/**
 * 调试用的扩展：当前行高亮 + 断点栏 + 行号。onBreakpoints：断点变了（加、去、改代码移动）时回调。
 * 加断点：点行号左边那一栏或者点行号（和 VS Code 一样），或者光标停在那一行按 F9。
 * 行号由这里提供（编辑器的 basicSetup 里关掉了），这样点行号也能切换断点；断点栏排在行号前面。
 */
export function debugExtensions(onBreakpoints: (lines: number[]) => void): Extension {
  const toggle = { mousedown(view: EditorView, line: { from: number }) { view.dispatch({ effects: toggleBreakpoint.of(line.from) }); return true; } };
  return [
    debugLine,
    breakpoints,
    Prec.highest(gutter({
      class: "cm-breakpoint-gutter",
      markers: (v) => v.state.field(breakpoints),
      initialSpacer: () => marker,
      // 每一行都有一格，鼠标移上去能看到淡淡的圆点，知道这里能点
      renderEmptyElements: true,
      domEventHandlers: toggle,
    })),
    Prec.high(lineNumbers({ domEventHandlers: toggle })),
    keymap.of([{ key: "F9", run: (view) => { view.dispatch({ effects: toggleBreakpoint.of(view.state.doc.lineAt(view.state.selection.main.head).from) }); return true; } }]),
    EditorView.updateListener.of((u) => {
      if (u.transactions.some((t) => t.effects.some((e) => e.is(toggleBreakpoint) || e.is(clearBreakpoints))) || (u.docChanged && u.state.field(breakpoints).size)) onBreakpoints(breakpointLines(u.view));
    }),
  ];
}

export { clearBreakpoints };
