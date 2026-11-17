/* Each run gets a fresh worker under an opaque-origin sandbox. */
(() => {
  const send = self.postMessage.bind(self), nativeFetch = self.fetch.bind(self);
  let kernel, pyodide, pythonRunner, language, base, typescript;
  function lockCapabilities() {
    for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "Worker", "SharedWorker", "importScripts", "indexedDB", "caches", "BroadcastChannel", "postMessage"]) {
      try { Object.defineProperty(self, name, { value: undefined, configurable: false, writable: false }); } catch { /* unavailable in this browser */ }
    }
    // Avoid exposing a channel back to the page through worker message listeners.
    for (const name of ["addEventListener", "removeEventListener", "dispatchEvent"]) {
      try { Object.defineProperty(self, name, { value: undefined, configurable: false, writable: false }); } catch { /* unavailable */ }
    }
  }
  async function initialize(message) {
    base = message.base; language = message.language;
    const vendor = message.vendor; // versioned paths relative to base, e.g. vendor/pyodide/<version>/
    await import(base + "kernel.js"); kernel = self.PracticeKernel; delete self.PracticeKernel;
    if (language === "typescript") {
      send({ type: "status", text: "正在加载 TypeScript 编译器…" });
      const response = await nativeFetch(base + vendor.typescript, { credentials: "omit" });
      if (!response.ok) throw Error("无法加载 TypeScript 编译器");
      typescript = new Function(await response.text() + "\nreturn ts;")();
    }
    if (language === "python") {
      send({ type: "status", text: "首次运行正在加载 Python 环境，资源会缓存在浏览器中…" });
      const { loadPyodide } = await import(base + vendor.pyodide + "pyodide.mjs");
      const response = await nativeFetch(base + "python-runner.py", { credentials: "omit" });
      if (!response.ok) throw Error("无法加载 Python 运行器"); pythonRunner = await response.text();
      pyodide = await loadPyodide({ indexURL: base + vendor.pyodide, stdout: () => {}, stderr: () => {} });
      pyodide.runPython(pythonRunner);
    }
    lockCapabilities();
    send({ type: "ready" });
  }
  async function run(message) {
    let code = message.code;
    if (language === "typescript") {
      const result = typescript.transpileModule(code, { compilerOptions: { target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.None }, reportDiagnostics: true });
      const diagnostics = (result.diagnostics || []).filter((d) => d.category === typescript.DiagnosticCategory.Error);
      if (diagnostics.length) throw Error(diagnostics.map((d) => typescript.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n"));
      code = result.outputText;
    }
    for (let index = 0; index < message.cases.length; index++) {
      send({ type: "case-start", index });
      const start = performance.now(); let result;
      try {
        if (language === "python") {
          pyodide.globals.set("__practice_request_json", JSON.stringify({ code, mode: message.mode, signature: message.signature, test: message.cases[index] }));
          result = JSON.parse(pyodide.runPython("__practice_run(__practice_request_json)"));
        } else result = kernel.executeJavaScript(code, message.mode, message.signature, message.cases[index]);
      } catch (error) { result = { actual: null, stdout: "", error: String(error?.message || error) }; }
      send({ type: "case-result", index, ...result, duration: performance.now() - start });
      // Yield between cases so cancellation messages are serviced.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    send({ type: "done" });
  }
  self.onmessage = (event) => {
    const message = event.data;
    (message.type === "init" ? initialize(message) : message.type === "run" ? run(message) : Promise.resolve()).catch((error) => send({ type: "fatal", error: String(error?.message || error) }));
  };
})();
