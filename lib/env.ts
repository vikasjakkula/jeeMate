export function requireEnv(name: string): string {
  const direct = process.env[name];
  const value = direct && direct.trim().length > 0 ? direct : null;
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

