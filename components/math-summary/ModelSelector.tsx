"use client";

import { FieldLabel, Input } from "@/components/ui/Field";

type ModelSelectorProps = {
  model: string;
  onModelChange: (value: string) => void;
};

export function ModelSelector({ model, onModelChange }: ModelSelectorProps) {
  return (
    <div>
      <FieldLabel htmlFor="model">Model</FieldLabel>
      <div className="flex">
        <div style={{ flex: 1 }}>
          <Input
            id="model"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            placeholder="gemini-1.5-flash"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="text"
          />
        </div>
        <div className="chip">Recommended: gemini-1.5-flash</div>
      </div>
    </div>
  );
}

