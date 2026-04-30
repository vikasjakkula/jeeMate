import { requireEnv } from "./env";

type GeminiGenerateContentRequest = {
  contents: Array<{
    parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    >;
  }>;
  generationConfig?: {
    // Latest docs use camelCase in REST generationConfig; keep snake_case optional for compatibility.
    responseMimeType?: "application/json" | string;
    responseJsonSchema?: unknown;
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

const DEFAULT_MODEL = "gemini-2.5-flash";
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

function isMathSummaryResponse(value: unknown): value is MathSummaryResponse {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.latex === "string";
}

function shouldRetryWithFallbackModel(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("not found") ||
    m.includes("listmodels") ||
    m.includes("not supported") ||
    m.includes("unsupported") ||
    m.includes("models/")
  );
}

async function postGeminiGenerateContent(params: {
  apiKey: string;
  model: string;
  requestBody: GeminiGenerateContentRequest;
  signal?: AbortSignal;
}): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    params.model
  )}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": params.apiKey,
    },
    body: JSON.stringify(params.requestBody),
    signal: params.signal,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      json?.error?.message ??
      `Gemini request failed with status ${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return json;
}

function extractCandidateText(responseJson: unknown): string {
  if (!responseJson || typeof responseJson !== "object") return "";
  const root = responseJson as Record<string, unknown>;
  const candidates = root.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const c0 = candidates[0];
  if (!c0 || typeof c0 !== "object") return "";
  const content = (c0 as Record<string, unknown>).content;
  if (!content || typeof content !== "object") return "";
  const parts = (content as Record<string, unknown>).parts;
  if (!Array.isArray(parts) || parts.length === 0) return "";
  const p0 = parts[0];
  if (!p0 || typeof p0 !== "object") return "";
  const text = (p0 as Record<string, unknown>).text;
  return typeof text === "string" ? text : "";
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
  const requested =
    params.model?.trim() || process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  const requestBody: GeminiGenerateContentRequest = {
    contents: [
      {
        parts: [{ text: buildMathSummaryPrompt(params.input) }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: {
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

  let json: unknown;
  try {
    json = await postGeminiGenerateContent({
      apiKey,
      model: requested,
      requestBody,
      signal: params.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (shouldRetryWithFallbackModel(msg)) {
      const fallback = FALLBACK_MODELS.find((m) => m !== requested) ?? DEFAULT_MODEL;
      json = await postGeminiGenerateContent({
        apiKey,
        model: fallback,
        requestBody,
        signal: params.signal,
      });
    } else {
      throw e;
    }
  }

  const text = extractCandidateText(json);
  if (text.trim().length === 0) {
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
  const requested =
    params.model?.trim() || process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

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
      responseMimeType: "application/json",
      responseJsonSchema: {
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

  let json: unknown;
  try {
    json = await postGeminiGenerateContent({
      apiKey,
      model: requested,
      requestBody,
      signal: params.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (shouldRetryWithFallbackModel(msg)) {
      const fallback = FALLBACK_MODELS.find((m) => m !== requested) ?? DEFAULT_MODEL;
      json = await postGeminiGenerateContent({
        apiKey,
        model: fallback,
        requestBody,
        signal: params.signal,
      });
    } else {
      throw e;
    }
  }

  const text = extractCandidateText(json);
  if (text.trim().length === 0) {
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

