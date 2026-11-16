"use client";

// 常用语言：顶栏上的按钮（所有人都能用），以及题解 / 演示里切换当前语言的小分段控件。
import { Button, Popover } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import clsx from "clsx";

import { OFFICIAL_LANGS, langShort } from "@/lib/langs";
import { usePrefs } from "@/lib/prefs";

/** 顶栏：显示默认语言，点开可以多选常用语言、指定默认语言 */
export function LangPicker() {
  const { langs, setLangs, saving, error, where } = usePrefs();
  const toggle = (id: string) => {
    if (langs.includes(id)) {
      if (langs.length > 1) setLangs(langs.filter((l) => l !== id)); // 至少留一种
    } else setLangs([...langs, id]);
  };
  const makeDefault = (id: string) => setLangs([id, ...langs.filter((l) => l !== id)]);
  return (
    <Popover>
      <Button aria-label={`常用语言：${langs.map(langShort).join("、")}`} size="sm" variant="ghost">
        <span className="font-pixel text-[11px] tracking-wider">{langShort(langs[0])}</span>
        {langs.length > 1 && <span className="font-pixel text-[10px] text-muted">+{langs.length - 1}</span>}
      </Button>
      <Popover.Content className="w-72" placement="bottom end">
        <Popover.Dialog className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1">
            <Popover.Heading className="text-sm font-semibold">常用语言</Popover.Heading>
            <p className="text-xs leading-5 text-muted">题解和演示里的代码按这里选的语言显示。可以选几种，其中一种是默认。</p>
          </div>
          <ul className="flex flex-col gap-1">
            {OFFICIAL_LANGS.map((l) => {
              const on = langs.includes(l.id), isDefault = langs[0] === l.id;
              return (
                <li key={l.id} className="flex items-center gap-2">
                  <button
                    aria-pressed={on}
                    className={clsx(
                      "flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                      on ? "bg-accent/10 text-foreground" : "text-muted hover:bg-foreground/[0.05]",
                    )}
                    type="button"
                    onClick={() => toggle(l.id)}
                  >
                    <span aria-hidden className={clsx("grid size-4 place-items-center rounded-[5px] border text-[10px] leading-none", on ? "border-accent bg-accent text-white" : "border-border")}>
                      {on ? "✓" : ""}
                    </span>
                    {l.label}
                  </button>
                  {isDefault ? (
                    <span className="w-14 text-center text-[11px] font-medium text-accent">默认</span>
                  ) : on ? (
                    <button className="w-14 rounded-md py-1 text-[11px] text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent" type="button" onClick={() => makeDefault(l.id)}>
                      设为默认
                    </button>
                  ) : (
                    <span className="w-14" />
                  )}
                </li>
              );
            })}
          </ul>
          <p className={clsx("text-[11px] leading-4", error ? "text-danger" : "text-muted")}>
            {error ? `没能存进进度仓：${error}` : saving ? "正在存进你的进度仓…" : where === "repo" ? "存在你进度仓的 settings.json 里，换设备也生效。" : "现在存在这个浏览器里；登录后会存进你的进度仓。"}
          </p>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/** 一段代码上方的语言切换：只有一种语言时不显示 */
export function LangTabs({ langs, value, onChange, label = "语言" }: { langs: string[]; value: string; onChange: (lang: string) => void; label?: string }) {
  if (langs.length < 2) return null;
  return (
    <Segment aria-label={label} className="max-w-full overflow-x-auto" selectedKey={value} size="sm" variant="ghost" onSelectionChange={(k) => onChange(String(k))}>
      {langs.map((l) => (
        <Segment.Item key={l} id={l}>
          {langShort(l)}
        </Segment.Item>
      ))}
    </Segment>
  );
}
