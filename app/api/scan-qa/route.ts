import { NextResponse } from "next/server";
import { generateLatexFromQuestionImage } from "@/lib/geminiFetch";

type RequestBody = {
  base64Data?: string;
  mimeType?: string;
  model?: string;
  mode?: "extract_only" | "extract_and_answer";
  extraInstructions?: string;
};

export async function POST(req: Request) {
  let body: RequestBody | null = null;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const base64Data = (body?.base64Data ?? "").trim();
  const mimeType = (body?.mimeType ?? "").trim();
  const mode = body?.mode ?? "extract_and_answer";

  if (!base64Data) {
    return NextResponse.json({ error: "Missing `base64Data`." }, { status: 400 });
  }
  if (!mimeType) {
    return NextResponse.json({ error: "Missing `mimeType`." }, { status: 400 });
  }
  if (!/^image\/(png|jpeg|webp)$/.test(mimeType)) {
    return NextResponse.json(
      { error: "Unsupported `mimeType`. Use image/png, image/jpeg, image/webp." },
      { status: 400 }
    );
  }
  if (base64Data.length > 8_000_000) {
    return NextResponse.json({ error: "Image is too large." }, { status: 400 });
  }

  try {
    const data = await generateLatexFromQuestionImage({
      base64Data,
      mimeType,
      model: body?.model,
      mode,
      extraInstructions: body?.extraInstructions,
      signal: req.signal,
    });
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

