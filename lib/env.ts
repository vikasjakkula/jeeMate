import { readFileSync } from "node:fs";
import path from "node:path";

function tryReadFromEnvExample(name: string): string | null {
  try {
    const filePath = path.join(process.cwd(), ".env.example");
    const raw = readFileSync(filePath, "utf8");
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      if (key !== name) continue;
      const value = trimmed.slice(idx + 1).trim();
      return value || null;
    }
  } catch {
    // ignore
  }
  return null;
}

export function requireEnv(name: string): string {
  const direct = process.env[name];
  const value = direct && direct.trim().length > 0 ? direct : tryReadFromEnvExample(name);
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

