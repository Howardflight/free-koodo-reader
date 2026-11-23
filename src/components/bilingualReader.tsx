import React, { useEffect, useRef, useState } from "react";
import { getIframeDoc } from "../utils/reader/docUtil";
import { cachedTranslation, completionUrl, translateParagraph, TranslationConfig } from "../utils/reader/bilingual";

export default function BilingualReader({ bookKey, chapter }: { bookKey: string; chapter: number }) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<TranslationConfig>(() => {
    try { return JSON.parse(localStorage.getItem("bilingual-config") || "null") || { baseUrl: "", model: "" }; }
    catch { return { baseUrl: "", model: "" }; }
  });
  const [apiKey, setApiKey] = useState("");
  const [texts, setTexts] = useState<string[]>([]);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    const id = ++generation.current;
    request.current?.abort();
    setBusy(false); setTranslations({}); setTexts([]);
    if (!open) return;
    const timer = setTimeout(() => {
      const paragraphs = getIframeDoc("EPUB", bookKey).flatMap(doc => doc ? Array.from(doc.querySelectorAll("p")) : [])
        .map(p => p.textContent?.trim() || "").filter(t => /[a-zA-Z]/.test(t));
      setTexts(paragraphs);
      setMessage(paragraphs.length ? `本章 ${paragraphs.length} 段，每次最多翻译 20 段` : "请等待章节加载后关闭并重新打开双语阅读");
      paragraphs.forEach(async (text, index) => {
        try {
          const value = await cachedTranslation(text, config);
          if (value && id === generation.current) setTranslations(old => ({ ...old, [index]: value }));
        } catch { /* API configuration may not yet be set. */ }
      });
    }, 400);
    return () => { clearTimeout(timer); ++generation.current; request.current?.abort(); };
  }, [open, bookKey, chapter, config]);
  async function run() {
    const controller = new AbortController();
    request.current = controller;
    const id = generation.current;
    setBusy(true);
    try {
      completionUrl(config.baseUrl);
      localStorage.setItem("bilingual-config", JSON.stringify(config));
      let count = 0;
      for (let i = 0; i < texts.length && count < 20; i++) {
        if (controller.signal.aborted || id !== generation.current) break;
        if (translations[i]) continue;
        setMessage(`正在翻译第 ${i + 1} 段，已完成 ${count} 段`);
        const result = await translateParagraph(texts[i], config, apiKey, controller.signal);
        if (controller.signal.aborted || id !== generation.current) break;
        setTranslations(old => ({ ...old, [i]: result }));
        count++;
      }
      if (id === generation.current) setMessage(controller.signal.aborted ? "已停止，已完成的译文已缓存" : "本次完成；可继续翻译后续段落");
    } catch (error) {
      if (id === generation.current) setMessage(controller.signal.aborted ? "已停止，已完成的译文已缓存" : error instanceof Error ? error.message : "翻译失败，请重试");
    } finally { if (id === generation.current) setBusy(false); }
  }
  return <div style={{ position: "fixed", right: 12, bottom: 55, zIndex: 10001 }}>
    <button onClick={() => setOpen(!open)}>中英对照</button>
    {open && <section aria-label="中英段落对照" style={{ position: "fixed", inset: "7vh 3vw", background: "#fffaf0", color: "#222", border: "1px solid #bbb", borderRadius: 12, padding: 16, overflowY: "auto", boxShadow: "0 8px 40px #0004" }}>
      <button style={{ float: "right" }} onClick={() => setOpen(false)}>关闭</button>
      <h2>中英段落对照</h2>
      <p>译文自动保存在本机。点击翻译会将原文发送至你填写的 API，并可能产生费用。</p>
      <label>Base URL<input style={{ width: "100%" }} disabled={busy} value={config.baseUrl} placeholder="https://your-server/v1" onChange={e => setConfig({ ...config, baseUrl: e.target.value })} /></label>
      <label>模型<input style={{ width: "100%" }} disabled={busy} value={config.model} onChange={e => setConfig({ ...config, model: e.target.value })} /></label>
      <label>API 密钥（仅本次会话）<input style={{ width: "100%" }} disabled={busy} type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} /></label>
      <button disabled={busy || !texts.length} onClick={run}>翻译接下来 20 段 / 重试</button>
      <button disabled={!busy} onClick={() => request.current?.abort()}>停止</button>
      <p role="status">{message}</p>
      {texts.map((text, index) => <article key={index} style={{ borderBottom: "1px solid #ddd", padding: "12px 0", lineHeight: 1.8 }}>
        <p lang="en">{text}</p><p lang="zh-CN" style={{ color: "#32634e" }}>{translations[index] || "尚未翻译"}</p>
      </article>)}
    </section>}
  </div>;
}
