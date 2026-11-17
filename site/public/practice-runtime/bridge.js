/* Runs in a sandboxed opaque-origin iframe; user code only runs in its worker. */
(() => {
  let connected = false;
  addEventListener("message", (event) => {
    if (connected || event.source !== parent || event.data?.type !== "practice-connect" || !event.ports[0]) return;
    connected = true;
    const port = event.ports[0], base = event.data.base;
    // Chrome rejects module blob:null workers created by opaque sandbox frames.
    // A data URL keeps the worker opaque and supports the same static ESM graph.
    const url = "data:text/javascript;charset=utf-8," + encodeURIComponent(`import ${JSON.stringify(base + "worker.js")};`);
    const worker = new Worker(url, { type: "module", credentials: "omit" });
    worker.onmessage = (message) => port.postMessage(message.data);
    worker.onerror = (error) => port.postMessage({ type: "fatal", error: error.message || "执行线程启动失败" });
    port.onmessage = (message) => {
      if (message.data?.type === "stop") { worker.terminate(); return; }
      worker.postMessage(message.data);
    };
    port.start();
    port.postMessage({ type: "connected" });
  });
  parent.postMessage({ type: "practice-frame-ready" }, "*");
})();
