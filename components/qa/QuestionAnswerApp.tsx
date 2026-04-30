"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FieldLabel, Textarea } from "@/components/ui/Field";
import { UploadBox, type UploadedFileItem } from "@/components/qa/UploadBox";
import { WhitePages } from "@/components/qa/WhitePages";

type ApiResponse = { latex: string } | { error: string };

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${Date.now()}-${crypto.randomUUID()}`;
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function QuestionAnswerApp() {
  const router = useRouter();
  const [items, setItems] = React.useState<UploadedFileItem[]>([]);
  const [questionsText, setQuestionsText] = React.useState("");
  const [latex, setLatex] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  function onAddFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const next: UploadedFileItem[] = arr
      .filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type))
      .map((file) => ({ id: uid(), file, progress: 100 }));
    setItems((prev) => [...next, ...prev].slice(0, 10));
  }

  function onRemove(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  function persistAndOpenAnswer(latexOut: string) {
    const id = uid();
    setLatex(latexOut);
    try {
      localStorage.setItem(
        `answers:${id}`,
        JSON.stringify({
          id,
          latex: latexOut,
          createdAt: Date.now(),
        })
      );
    } catch {
      // ignore storage errors; still navigate.
    }
    router.push(`/answers/${encodeURIComponent(id)}`);
  }

  async function onGenerateAnswers() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      // Prefer image if present; otherwise fall back to text-only route.
      if (items.length > 0) {
        const first = items[0].file;
        const base64Data = await fileToBase64(first);
        const res = await fetch("/api/scan-qa", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            base64Data,
            mimeType: first.type,
            mode: "extract_and_answer",
            extraInstructions:
              "Answer in LaTeX only.\n- Use ONLY display math blocks: \\[ ... \\]\n- Use plain newlines (\\n)\n- No prose, no markdown.",
          }),
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
        persistAndOpenAnswer(data.latex);
        return;
      }

      const trimmed = questionsText.trim();
      if (!trimmed) throw new Error("Add questions (or upload an image) first.");

      const res = await fetch("/api/math-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: `Answer these questions in LaTeX-only.\nUse ONLY display blocks: \\[ ... \\].\nNo prose.\n\n${trimmed}`,
        }),
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
      persistAndOpenAnswer(data.latex);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setLatex("");
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  function onCancel() {
    abortRef.current?.abort();
  }

  return (
    <div className="container containerWide">
      <div className="appShell">
        <header className="header headerTight">
          <div className="headerInner">
            <div className="headerLeft">
              <h1>Question → Answer (LaTeX only)</h1>
              <p>Upload questions, scan, then generate LaTeX on white pages.</p>
            </div>
            <div className="headerRight">
              <div className="statusBadge">
                <span className={`dot ${isLoading ? "dot-warn" : "dot-ok"}`} />
                {isLoading ? "Working…" : "Ready"}
              </div>
            </div>
          </div>
        </header>

        <main className="qaLayout">
          <section className="card qaCard">
            <div className="sectionTitle">Upload</div>
            <UploadBox items={items} onAddFiles={onAddFiles} onRemove={onRemove} />

            <div className="qaControls">
              <div className="qaButtons">
                <Button onClick={onGenerateAnswers} disabled={isLoading}>
                  Generate answers (LaTeX)
                </Button>
                <Button
                  variant="secondary"
                  onClick={onCancel}
                  disabled={!isLoading}
                >
                  Cancel
                </Button>
              </div>

              {error ? <div className="qaError">{error}</div> : null}
            </div>

            <div className="qaText">
              <FieldLabel htmlFor="questionsText">
                Questions (editable, LaTeX-friendly)
              </FieldLabel>
              <Textarea
                id="questionsText"
                value={questionsText}
                onChange={(e) => setQuestionsText(e.target.value)}
                placeholder={
                  "Type questions here (optional if you upload an image).\nExample:\n1) Solve 2x+5=17\n2) Differentiate x^2+3x"
                }
              />
            </div>
          </section>

          <section className="qaPages">
            <WhitePages latex={latex} />
          </section>
        </main>
      </div>
    </div>
  );
}

