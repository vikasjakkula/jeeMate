"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { WhitePages } from "@/components/qa/WhitePages";
import { Button } from "@/components/ui/Button";

type StoredAnswer = {
  id: string;
  latex: string;
  createdAt: number;
  model?: string;
};

export default function AnswerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? "";

  const [latex, setLatex] = React.useState("");

  React.useEffect(() => {
    if (!id) return;
    try {
      const raw = localStorage.getItem(`answers:${id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredAnswer;
      if (parsed && typeof parsed.latex === "string") setLatex(parsed.latex);
    } catch {
      // ignore
    }
  }, [id]);

  function onCopy() {
    if (!latex) return;
    void navigator.clipboard.writeText(latex);
  }

  return (
    <div className="container containerWide">
      <div className="appShell">
        <header className="header headerTight">
          <div className="headerInner">
            <div className="headerLeft">
              <h1>Answers</h1>
              <p>
                ID: <code>{id}</code>
              </p>
            </div>
            <div className="headerRight">
              <div className="flex">
                <Button variant="secondary" onClick={() => router.push("/")}>
                  Back
                </Button>
                <Button onClick={onCopy} disabled={!latex}>
                  Copy LaTeX
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="qaPages">
          <WhitePages latex={latex} />
        </main>
      </div>
    </div>
  );
}

