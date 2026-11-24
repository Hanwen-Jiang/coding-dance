// 演示每一步的图是 render.ts 拼出来的一段 HTML。整段换掉的话，每一步所有元素都是新的：
// 入场的淡入动画每步重播一遍（整张图闪一下），格子换颜色也没有过渡（新元素没有「之前的颜色」），横向滚动还会回到开头。
// 这里把旧的 DOM 原地改成新 HTML 的样子：
//   - 带 data-key 的同层级节点按 key 匹配并复用（树/链表节点改坐标时可以平滑 glide 过去）；
//   - 没有 data-key 的按位置和标签类型一一对应，只改属性和文字；
// 这样没变的部分纹丝不动，变了颜色/坐标的元素走 CSS 过渡，新出现的图才淡入。

/** 把 el 的内容改成 html */
export function morphInto(el: Element, html: string) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html; // template 解析时 <svg> 里的元素也会在 SVG 命名空间里
  morphChildren(el, tpl.content);
}

function sameKind(a: Node, b: Node) {
  return a.nodeType === b.nodeType && a.nodeName === b.nodeName && (a as Element).namespaceURI === (b as Element).namespaceURI;
}

function keyOf(n: Node): string | null {
  return n.nodeType === Node.ELEMENT_NODE ? (n as Element).getAttribute("data-key") : null;
}

function morphChildren(from: Node, to: Node) {
  const olds = Array.from(from.childNodes);
  const news = Array.from(to.childNodes);
  const hasKeys = news.some((n) => keyOf(n) !== null) || olds.some((n) => keyOf(n) !== null);

  if (!hasKeys) {
    news.forEach((n, i) => {
      const o = olds[i];
      if (!o) from.appendChild(n);
      else if (sameKind(o, n)) morphNode(o, n);
      else from.replaceChild(n, o);
    });
    for (let i = news.length; i < olds.length; i++) from.removeChild(olds[i]);
    return;
  }

  // 按 data-key 复用节点，其余按顺序配对
  const byKey = new Map<string, Element>();
  const unkeyed: Node[] = [];
  for (const o of olds) {
    const k = keyOf(o);
    if (k !== null) byKey.set(k, o as Element);
    else unkeyed.push(o);
  }
  const used = new Set<Node>();
  let u = 0;

  news.forEach((n, i) => {
    const k = keyOf(n);
    let match: Node | undefined;
    if (k !== null) {
      const hit = byKey.get(k);
      if (hit && sameKind(hit, n)) {
        match = hit;
        byKey.delete(k);
      }
    } else {
      while (u < unkeyed.length && used.has(unkeyed[u])) u++;
      const cand = unkeyed[u];
      if (cand && sameKind(cand, n)) {
        match = cand;
        u++;
      }
    }

    const ref = from.childNodes[i] ?? null;
    if (match) {
      used.add(match);
      morphNode(match, n);
      if (match !== ref) from.insertBefore(match, ref);
    } else {
      from.insertBefore(n, ref);
    }
  });

  for (const o of olds) {
    if (!used.has(o) && o.parentNode === from) from.removeChild(o);
  }
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
