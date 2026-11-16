// 题面配图：把题面 HTML 里力扣的图片换成演示同款的视图（spec.figures：图片文件名 → 视图）。
// 换掉的图在配图下面留一个「力扣原图」的链接；没有配图的图片原样保留。
import { renderViews } from "@/components/demo/render";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Figures = Record<string, Record<string, any>[]>;

// <p><img src=".../images/0226/invert1-tree.jpg" ...></p>：整段换掉，免得 <div> 套在 <p> 里
const IMG = /(<p>\s*)?<img\b[^>]*?\bsrc="([^"]*\/images\/\d{4}\/([^"/]+))"[^>]*>(\s*<\/p>)?/g;

export function withFigures(html: string, figures?: Figures | null) {
  if (!figures || !html) return html;
  return html.replace(IMG, (all, _open, src: string, file: string) => {
    const views = figures[file];
    if (!views || !views.length) return all;
    return `<div class="demo lc-fig">${renderViews(views)}<a class="lc-orig" href="${src}" rel="noopener" target="_blank">力扣原图 ↗</a></div>`;
  });
}
