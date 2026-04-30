"use client";

import { Button } from "@/components/ui/Button";

type ResultPanelProps = {
  latex: string;
  error: string | null;
  isLoading: boolean;
  onCopy: () => void;
  onClear: () => void;
};

export function ResultPanel({
  latex,
  error,
  isLoading,
  onCopy,
  onClear,
}: ResultPanelProps) {
  return (
    <div>
      <div className="resultHeader">
        <div className="resultTitle">LaTeX output</div>
        <div className="flex">
          <Button variant="secondary" onClick={onClear} disabled={isLoading}>
            Clear
          </Button>
          <Button onClick={onCopy} disabled={isLoading || latex.length === 0}>
            Copy
          </Button>
        </div>
      </div>

      <div className="response">
        {isLoading ? (
          <div className="muted">
            <span className="loading">⟳</span> Generating…
          </div>
        ) : error ? (
          <div className="errorText">{error}</div>
        ) : latex ? (
          latex
        ) : (
          <div className="muted">No output yet.</div>
        )}
      </div>
    </div>
  );
}

