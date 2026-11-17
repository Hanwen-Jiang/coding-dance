// 演示每一步的图是 render.ts 拼出来的一段 HTML。整段换掉的话，每一步所有元素都是新的：
// 入场的淡入动画每步重播一遍（整张图闪一下），格子换颜色也没有过渡（新元素没有「之前的颜色」），横向滚动还会回到开头。
// 这里把旧的 DOM 原地改成新 HTML 的样子：同一位置、同一种标签的节点只改属性和文字，结构变了的地方才替换或增删。
// 这样没变的部分纹丝不动，变了颜色的格子走 CSS 过渡，新出现的图才淡入。

/** 把 el 的内容改成 html（按位置一一对应，不按 key） */
export function morphInto(el: Element, html: string) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html; // template 解析时 <svg> 里的元素也会在 SVG 命名空间里
  morphChildren(el, tpl.content);
}

function sameKind(a: Node, b: Node) {
  return a.nodeType === b.nodeType && a.nodeName === b.nodeName && (a as Element).namespaceURI === (b as Element).namespaceURI;
}

function morphChildren(from: Node, to: Node) {
  const olds = Array.from(from.childNodes);
  const news = Array.from(to.childNodes);
  news.forEach((n, i) => {
    const o = olds[i];
    if (!o) from.appendChild(n);
    else if (sameKind(o, n)) morphNode(o, n);
    else from.replaceChild(n, o);
  });
  for (let i = news.length; i < olds.length; i++) from.removeChild(olds[i]);
}

function morphNode(o: Node, n: Node) {
  if (o.nodeType !== Node.ELEMENT_NODE) {
    if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
    return;
  }
  const a = o as Element, b = n as Element;
  for (const { name } of Array.from(a.attributes)) if (!b.hasAttribute(name)) a.removeAttribute(name);
  for (const { name, value } of Array.from(b.attributes)) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  morphChildren(a, b);
}
