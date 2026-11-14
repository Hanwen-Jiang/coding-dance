// 同步页和力扣页面之间的「桥」。用户在 leetcode.cn 上点书签，书签打开本站的同步页；
// 同步页把只读查询用 postMessage 交给力扣页面，力扣页面用它现成的登录状态发请求，再把结果传回来。
// 双方都只认对方的来源：本站只收 https://leetcode.cn 的回复，书签只收本站的请求。
import { unwrap, type Transport } from "./leetcode.ts";

export const LEETCODE_ORIGIN = "https://leetcode.cn";

type Res = { status: number; json?: any; text?: string };

export function createBridge(peer: Window, { origin = LEETCODE_ORIGIN, timeout = 45000 } = {}) {
  let seq = 0;
  const pending = new Map<number, (r: Res) => void>();
  let onReady: ((v: boolean) => void) | null = null;
  const listener = (e: MessageEvent) => {
    if (e.origin !== origin || e.source !== peer) return;
    const m = e.data || {};
    if (m.type === "hot100:ready") onReady?.(true);
    if (m.type === "hot100:result" && pending.has(m.id)) { pending.get(m.id)!(m.res); pending.delete(m.id); }
  };
  window.addEventListener("message", listener);

  /** 和力扣页面打个招呼：书签装好了、页面还开着，就会回应 */
  const hello = (ms = 3000) => new Promise<boolean>((resolve) => {
    const t = setTimeout(() => { onReady = null; resolve(false); }, ms);
    onReady = (v) => { clearTimeout(t); onReady = null; resolve(v); };
    try { peer.postMessage({ type: "hot100:hello" }, origin); } catch { clearTimeout(t); resolve(false); }
  });

  const transport: Transport = (query, variables) => new Promise((resolve, reject) => {
    const id = ++seq;
    const t = setTimeout(() => { pending.delete(id); reject(new Error("力扣页面没有回应：确认那个标签页还开着，必要时回到力扣页面再点一次书签")); }, timeout);
    pending.set(id, (res) => { clearTimeout(t); try { resolve(unwrap(res)); } catch (e) { reject(e); } });
    try { peer.postMessage({ type: "hot100:query", id, query, variables }, origin); } catch (e) { clearTimeout(t); pending.delete(id); reject(e); }
  });

  return { hello, transport, close: () => window.removeEventListener("message", listener) };
}
