import { requireEnv } from "./env";

type GeminiGenerateContentRequest = {
  contents: Array<{
    parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    >;
  }>;
  generationConfig?: {
    response_mime_type?: "application/json" | string;
    response_json_schema?: unknown;
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
};

export type MathSummaryResponse = {
  latex: string;
};

function isMathSummaryResponse(value: unknown): value is MathSummaryResponse {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.latex === "string";
}

function buildMathSummaryPrompt(input: string) {
  return [
    "You are a math assistant that returns ONLY LaTeX, wrapped in JSON.",
    "",
    "Rules:",
    "- Output MUST be a valid JSON object matching the schema.",
    '- The JSON must contain ONLY the key "latex".',
    "- The value must be ONLY LaTeX math (no explanations, no markdown, no prose).",
    "- Prefer a single display-math block: \\[ ... \\].",
    "",
    "Task:",
    "Summarize the math in the user's input as concise equations/steps.",
    "",
    "User input:",
    input,
  ].join("\n");
}

function buildScanAndAnswerPrompt(params: {
  mode: "extract_only" | "extract_and_answer";
  extraInstructions?: string;
}) {
  return [
    "You are a vision-enabled math assistant.",
    "",
    "You will be given an image containing questions/problems.",
    "",
    "Rules:",
    "- Output MUST be a valid JSON object matching the schema.",
    '- The JSON must contain ONLY the key "latex".',
    "- The value must be ONLY LaTeX math (no explanations, no markdown, no prose).",
    "- Use a clean structure with sections, e.g. \\[ ... \\] blocks per question.",
    "",
    params.mode === "extract_only"
      ? "Task: Extract the questions from the image and present them in LaTeX (no answers)."
      : "Task: Extract the questions from the image and write concise LaTeX-only answers/solutions.",
    params.extraInstructions ? `\nExtra instructions:\n${params.extraInstructions}` : "",
  ].join("\n");
}

export async function generateMathSummaryLatexJson(params: {
  input: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<MathSummaryResponse> {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = params.model ?? process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

  // Per docs, the generateContent endpoint is /v1beta/models/{MODEL_ID}:generateContent
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const requestBody: GeminiGenerateContentRequest = {
    contents: [
      {
        parts: [{ text: buildMathSummaryPrompt(params.input) }],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      response_json_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          latex: {
            type: "string",
            description:
              "ONLY LaTeX math content (no prose). Prefer a single \\[...\\] block.",
          },
        },
        required: ["latex"],
      },
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 512,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      json?.error?.message ??
      `Gemini request failed with status ${res.status} ${res.statusText}`;
    throw new Error(message);
  }

  const text: unknown = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Gemini returned an empty response.");
  }

  // With response_mime_type: application/json, Gemini typically returns JSON text inside parts[0].text.
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini did not return valid JSON text.");
  }

  if (!isMathSummaryResponse(parsed)) {
    throw new Error("Gemini JSON did not match expected schema.");
  }

  return { latex: parsed.latex };
}

export async function generateLatexFromQuestionImage(params: {
  base64Data: string;
  mimeType: string;
  mode: "extract_only" | "extract_and_answer";
  model?: string;
  signal?: AbortSignal;
  extraInstructions?: string;
}): Promise<MathSummaryResponse> {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = params.model ?? process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const requestBody: GeminiGenerateContentRequest = {
    contents: [
      {
        parts: [
          { text: buildScanAndAnswerPrompt({ mode: params.mode, extraInstructions: params.extraInstructions }) },
          { inlineData: { mimeType: params.mimeType, data: params.base64Data } },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      response_json_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          latex: { type: "string" },
        },
        required: ["latex"],
      },
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 1024,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      json?.error?.message ??
      `Gemini request failed with status ${res.status} ${res.statusText}`;
    throw new Error(message);
  }

  const text: unknown = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Gemini returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini did not return valid JSON text.");
  }

  if (!isMathSummaryResponse(parsed)) {
    throw new Error("Gemini JSON did not match expected schema.");
  }

  return { latex: parsed.latex };
}

