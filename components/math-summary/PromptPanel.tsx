"use client";

import { FieldLabel, Textarea } from "@/components/ui/Field";

type PromptPanelProps = {
  input: string;
  onInputChange: (value: string) => void;
};

export function PromptPanel({ input, onInputChange }: PromptPanelProps) {
  return (
    <div>
      <FieldLabel htmlFor="mathInput">Math input</FieldLabel>
      <div className="panel">
        <div className="panelRow">
          <div className="panelCol">
            <Textarea
              id="mathInput"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={
                "Example:\nSolve: 2x + 5 = 17\n\nor\nSummarize: derivative of x^2 + 3x"
              }
            />
          </div>
        </div>
        <div className="panelHint">
          The API will return JSON with one field: <code>{"{ latex: \"...\" }"}</code>
          . The value will be LaTeX-only.
        </div>
      </div>
    </div>
  );
}

