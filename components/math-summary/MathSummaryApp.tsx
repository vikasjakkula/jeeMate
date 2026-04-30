"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { ModelSelector } from "@/components/math-summary/ModelSelector";
import { PromptPanel } from "@/components/math-summary/PromptPanel";
import { ResultPanel } from "@/components/math-summary/ResultPanel";

type ApiResponse = { latex: string } | { error: string };

export function MathSummaryApp() {
  const [input, setInput] = React.useState(
    "Solve: 2x + 5 = 17\n\nSummarize the steps."
  );
  const [model, setModel] = React.useState("gemini-1.5-flash");
  const [latex, setLatex] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  async function onGenerate() {
    const trimmed = input.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/math-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: trimmed, model: model.trim() || undefined }),
        signal: controller.signal,
      });

      const data = (await res.json()) as ApiResponse;
      if (!res.ok) {
        const msg = "error" in data ? data.error : "Request failed";
        throw new Error(msg);
      }

      if (!("latex" in data) || typeof data.latex !== "string") {
        throw new Error("Unexpected API response.");
      }

      setLatex(data.latex);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setLatex("");
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  function onCopy() {
    if (!latex) return;
    void navigator.clipboard.writeText(latex);
  }

  function onClear() {
    setLatex("");
    setError(null);
  }

  function onCancel() {
    abortRef.current?.abort();
  }

  return (
    <div className="container">
      <div className="appShell">
        <header className="header">
          <div className="headerInner">
            <div className="headerLeft">
              <h1>Math Summary (LaTeX JSON)</h1>
              <p>
                POST → Gemini <code>:generateContent</code> → strict JSON schema →{" "}
                LaTeX-only
              </p>
            </div>
            <div className="headerRight">
              <div className="statusBadge">
                <span className={`dot ${isLoading ? "dot-warn" : "dot-ok"}`} />
                {isLoading ? "Working…" : "Ready"}
              </div>
            </div>
          </div>
        </header>

        <main className="grid">
          <section className="card">
            <div className="sectionTitle">Input</div>

            <div className="stack">
              <ModelSelector model={model} onModelChange={setModel} />
              <PromptPanel input={input} onInputChange={setInput} />
              <div className="actionsRow">
                <div className="flex">
                  <Button onClick={onGenerate} disabled={isLoading}>
                    Generate
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={onCancel}
                    disabled={!isLoading}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="muted small">
                  Server reads <code>GEMINI_API_KEY</code> from env (not exposed to
                  the browser).
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="sectionTitle">Output</div>
            <ResultPanel
              latex={latex}
              error={error}
              isLoading={isLoading}
              onCopy={onCopy}
              onClear={onClear}
            />
          </section>
        </main>

        <footer className="footer">
          <div className="footerInner">
            <div className="muted small">
              Tip: Use <code>\\[ ... \\]</code> display math for clean rendering in
              most LaTeX engines.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

