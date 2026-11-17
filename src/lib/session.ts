import "server-only";

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export type SessionPayload = {
  userId: string;
};

export function createSessionToken(payload: SessionPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}
