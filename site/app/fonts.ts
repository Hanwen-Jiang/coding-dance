// 字体自托管：文件在 app/fonts/（取自 fontsource 5.3.0 的 latin 子集，OFL 许可证在同一目录），
// 构建时由 next/font 输出到 /_next/static/media/（文件名带哈希，可以长期缓存），不再请求 Google Fonts（国内经常连不上，还会挡住首屏）。
// 三个字体通过 CSS 变量接到 globals.css 的 --font-sans / --font-mono / .font-pixel 上；变量类要加在 <html> 上。
import localFont from "next/font/local";

// unicode-range 和 fontsource / Google Fonts 的 latin 子集相同：中文字符直接用后面的系统字体。
// next/font 的参数必须是字面量（构建时静态读取），所以三处各写一遍。

/** 正文：可变字体，一个文件包含 100–900 所有字重（站点用到 400–800） */
export const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" }],
  // 默认按 Arial 生成一个调整过尺寸的后备字体，字体换上来时文字宽度基本不变
});

/** 代码：只在代码块、演示和编辑器里用，不预加载；后备是 globals.css 里的系统等宽字体 */
export const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin-wght-normal.woff2",
  weight: "100 800",
  style: "normal",
  display: "swap",
  variable: "--font-jetbrains-mono",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" }],
  preload: false,
  adjustFontFallback: false,
});

/** 像素字体：页头页脚每页都有，8 KB，预加载。
 *  原来是 display=block（等字体、期间文字不可见）；现在 swap，等待期间用按 Silkscreen 宽度缩放过的 Arial 顶上，换字体时文字宽度基本不跳 */
export const silkscreen = localFont({
  src: "./fonts/silkscreen-latin-400-normal.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-silkscreen",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" }],
});
