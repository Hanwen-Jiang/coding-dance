import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

// Token colors follow Microsoft's built-in Light+ / Dark+ themes:
// https://github.com/microsoft/vscode/tree/main/extensions/theme-defaults/themes
const palettes = {
  light: {
    background: "#ffffff", foreground: "#000000", gutter: "#858585", gutterActive: "#333333", divider: "#ececec",
    activeLine: "#f5f5f5", selection: "#add6ff", inactiveSelection: "#e5ebf1", caret: "#000000",
    keyword: "#0000ff", control: "#af00db", string: "#a31515", number: "#098658", comment: "#008000",
    type: "#267f99", function: "#795e26", variable: "#001080", constant: "#0070c1", escape: "#ee0000", invalid: "#cd3131",
    popup: "#ffffff", popupBorder: "#d0d7de", popupText: "#24292f", popupDetail: "#57606a",
    popupHover: "#f4f6f8", popupSelected: "#e8f0ff", popupSelectedBorder: "#c5d9f3", popupMatch: "#0065a9", iconBackground: "#f3f4f6",
    shadow: "0 8px 24px #00000014, 0 2px 6px #0000000a", bracketBorder: "#b9b9b9", bracketBackground: "#bad0f833",
  },
  dark: {
    background: "#1e1e1e", foreground: "#d4d4d4", gutter: "#858585", gutterActive: "#c6c6c6", divider: "#303031",
    activeLine: "#2a2d2e", selection: "#264f78", inactiveSelection: "#3a3d41", caret: "#aeafad",
    keyword: "#569cd6", control: "#c586c0", string: "#ce9178", number: "#b5cea8", comment: "#6a9955",
    type: "#4ec9b0", function: "#dcdcaa", variable: "#9cdcfe", constant: "#4fc1ff", escape: "#d7ba7d", invalid: "#f44747",
    popup: "#252526", popupBorder: "#454545", popupText: "#d4d4d4", popupDetail: "#a6a6a6",
    popupHover: "#303031", popupSelected: "#2c425d", popupSelectedBorder: "#3b5879", popupMatch: "#4fc1ff", iconBackground: "#303034",
    shadow: "0 8px 28px #0000004d, 0 2px 8px #00000033", bracketBorder: "#888888", bracketBackground: "#3a3a3a",
  },
};

/** Keep geometry, token colors and completion widgets in one scoped theme. */
export function practiceEditorTheme(dark: boolean) {
  const color = dark ? palettes.dark : palettes.light;
  const icon = (symbol: string, foreground: string) => ({ color: foreground, "&::after": { content: JSON.stringify(symbol) } });
  return [
    EditorView.theme({
      "&": { color: color.foreground, backgroundColor: color.background, fontSize: "14px", fontWeight: "400" },
      "&.cm-focused": { outline: "none" },
      ".cm-scroller": { fontFamily: "var(--font-mono)", fontSize: "14px", lineHeight: "24px", fontVariantLigatures: "none", fontFeatureSettings: "'liga' 0, 'calt' 0" },
      // The inset belongs to the document, not each highlighted line. Column zero,
      // the caret and the active-line fill consequently have the same left edge.
      ".cm-content": { padding: "14px 0 14px 12px", minHeight: "100%", caretColor: color.caret, fontSize: "14px", lineHeight: "24px", tabSize: "4" },
      ".cm-line": { padding: "0 16px 0 0", lineHeight: "24px" },
      ".cm-gutters": { padding: "0", backgroundColor: color.background, color: color.gutter, border: "none", borderRight: `1px solid ${color.divider}`, fontFamily: "var(--font-mono)", fontSize: "14px", lineHeight: "24px" },
      ".cm-lineNumbers .cm-gutterElement": { boxSizing: "border-box", minWidth: "38px", padding: "0 8px 0 10px", lineHeight: "24px" },
      ".cm-foldGutter": { width: "16px" },
      ".cm-foldGutter .cm-gutterElement": { padding: "0", width: "16px", textAlign: "center", fontSize: "11px", lineHeight: "24px" },
      ".cm-activeLine": { backgroundColor: color.activeLine },
      ".cm-activeLineGutter": { backgroundColor: "transparent", color: color.gutterActive },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: color.caret },
      ".cm-selectionBackground": { backgroundColor: color.inactiveSelection },
      "&.cm-focused .cm-selectionBackground": { backgroundColor: `${color.selection} !important` },
      ".cm-content ::selection": { backgroundColor: `${color.selection} !important` },
      ".cm-selectionMatch": { backgroundColor: dark ? "#add6ff26" : "#add6ff55" },
      ".cm-searchMatch": { backgroundColor: dark ? "#ea5c004d" : "#ea5c0033", outline: `1px solid ${color.popupSelectedBorder}` },
      ".cm-matchingBracket": { backgroundColor: color.bracketBackground, outline: `1px solid ${color.bracketBorder}`, color: "inherit" },
      ".cm-nonmatchingBracket": { backgroundColor: "transparent", outline: `1px solid ${color.invalid}` },
      ".cm-foldPlaceholder": { backgroundColor: color.popupHover, color: color.popupDetail, borderColor: color.popupBorder, borderRadius: "3px" },
      ".cm-panels": { backgroundColor: color.popup, color: color.popupText },

      ".cm-tooltip": { backgroundColor: color.popup, color: color.popupText, border: `1px solid ${color.popupBorder}`, borderRadius: "10px", boxShadow: color.shadow, zIndex: "300", fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: "400" },
      ".cm-tooltip.cm-tooltip-autocomplete": { padding: "4px", overflow: "visible" },
      ".cm-tooltip.cm-tooltip-autocomplete > ul": { minWidth: "min(250px, calc(100vw - 32px))", maxWidth: "min(420px, calc(100vw - 32px))", maxHeight: "240px", height: "auto", padding: "0", margin: "0", borderRadius: "6px", fontFamily: "var(--font-mono)", fontSize: "13px", lineHeight: "26px", scrollbarWidth: "thin" },
      ".cm-tooltip.cm-tooltip-autocomplete > ul > li": { display: "flex", alignItems: "center", gap: "8px", boxSizing: "border-box", minHeight: "26px", padding: "0 8px", margin: "1px 0", borderRadius: "5px", lineHeight: "26px", color: color.popupText, transition: "background-color 90ms ease" },
      ".cm-tooltip.cm-tooltip-autocomplete > ul > li:not([aria-selected=\"true\"]):hover": { backgroundColor: color.popupHover },
      ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected=\"true\"]": { backgroundColor: color.popupSelected, color: color.popupText, boxShadow: `inset 0 0 0 1px ${color.popupSelectedBorder}` },
      ".cm-tooltip-autocomplete-disabled > ul > li[aria-selected=\"true\"]": { opacity: "0.55" },
      ".cm-completionLabel": { overflow: "hidden", textOverflow: "ellipsis", minWidth: "0" },
      ".cm-completionMatchedText": { color: color.popupMatch, fontWeight: "600", textDecoration: "none" },
      ".cm-completionDetail": { marginLeft: "auto", paddingLeft: "12px", color: color.popupDetail, fontFamily: "var(--font-sans)", fontStyle: "normal", fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis" },
      ".cm-completionIcon": { display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: "0", boxSizing: "border-box", width: "16px", height: "16px", padding: "0", borderRadius: "3px", border: "1px solid color-mix(in srgb, currentColor 20%, transparent)", backgroundColor: color.iconBackground, fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: "600", lineHeight: "1", opacity: "1", "&::after": { content: '"·"' } },
      ".cm-completionIcon-function, .cm-completionIcon-method": icon("ƒ", color.function),
      ".cm-completionIcon-variable, .cm-completionIcon-property": icon("v", color.variable),
      ".cm-completionIcon-class, .cm-completionIcon-interface": icon("C", color.type),
      ".cm-completionIcon-type": icon("T", color.type),
      ".cm-completionIcon-constant, .cm-completionIcon-enum": icon("c", color.constant),
      ".cm-completionIcon-keyword": icon("K", color.control),
      ".cm-completionIcon-namespace": icon("N", color.type),
      ".cm-completionIcon-text": icon("a", color.popupDetail),
      ".cm-tooltip.cm-completionInfo": { margin: "0 6px", padding: "10px 12px", maxWidth: "min(360px, calc(100vw - 32px))", maxHeight: "240px", overflow: "auto", fontFamily: "var(--font-sans)", fontSize: "12px", lineHeight: "1.65", whiteSpace: "pre-wrap" },
      ".cm-completionInfo code, .cm-completionInfo pre": { fontFamily: "var(--font-mono)", fontSize: "12px", color: color.popupText },
      ".cm-completionInfo p": { margin: "0 0 6px" },
      "@media (prefers-reduced-motion: reduce)": { ".cm-tooltip-autocomplete > ul > li": { transition: "none" } },
    }, { dark }),
    syntaxHighlighting(HighlightStyle.define([
      { tag: tags.variableName, color: color.variable },
      { tag: tags.propertyName, color: color.variable },
      { tag: [tags.keyword, tags.definitionKeyword, tags.modifier, tags.self, tags.bool, tags.null], color: color.keyword },
      { tag: [tags.controlKeyword, tags.moduleKeyword, tags.operatorKeyword], color: color.control },
      { tag: [tags.string, tags.special(tags.string), tags.character], color: color.string },
      { tag: tags.number, color: color.number },
      { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: color.comment },
      { tag: [tags.typeName, tags.className, tags.namespace], color: color.type },
      { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.function(tags.definition(tags.variableName))], color: color.function },
      { tag: [tags.constant(tags.variableName), tags.standard(tags.variableName)], color: color.constant },
      { tag: [tags.operator, tags.punctuation, tags.bracket, tags.separator], color: color.foreground },
      { tag: tags.regexp, color: color.string },
      { tag: tags.escape, color: color.escape },
      { tag: tags.meta, color: color.type },
      { tag: tags.invalid, color: color.invalid },
    ])),
  ];
}
