import { NextResponse } from "next/server";
import { generateMathSummaryLatexJson } from "@/lib/geminiFetch";

type RequestBody = {
  input?: string;
};

export async function POST(req: Request) {
  let body: RequestBody | null = null;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const input = (body?.input ?? "").trim();
  if (input.length === 0) {
    return NextResponse.json({ error: "Missing `input`." }, { status: 400 });
  }
  if (input.length > 6000) {
    return NextResponse.json(
      { error: "`input` is too long." },
      { status: 400 }
    );
  }

  try {
    const data = await generateMathSummaryLatexJson({
      input,
      signal: req.signal,
    });
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

