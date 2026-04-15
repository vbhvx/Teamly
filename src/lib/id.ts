import { randomBytes } from "crypto";

export function generateId(prefix: string): string {
  const randomHex = randomBytes(12).toString("hex");
  return `${prefix}_${randomHex}`;
}

