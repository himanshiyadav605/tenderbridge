import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "tb_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (typeof secret !== "string" || secret.trim().length === 0) {
    const error = new Error("Session signing is not configured.");
    error.code = "SESSION_SECRET_MISSING";
    throw error;
  }
  return secret;
}

export function createSessionToken(userId) {
  const secret = getSecret();
  const body = Buffer.from(
    JSON.stringify({
      sub: String(userId),
      exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    })
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function readSession(token) {
  if (typeof token !== "string" || token.length === 0) {
    return { state: "missing" };
  }

  let secret;
  try {
    secret = getSecret();
  } catch {
    return { state: "invalid" };
  }

  const separator = token.lastIndexOf(".");
  if (separator <= 0) {
    return { state: "invalid" };
  }

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return { state: "invalid" };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { state: "invalid" };
  }

  if (!payload || typeof payload.sub !== "string" || typeof payload.exp !== "number") {
    return { state: "invalid" };
  }

  if (!Number.isFinite(payload.exp) || Date.now() > payload.exp) {
    return { state: "expired" };
  }

  return { state: "ok", sub: payload.sub, exp: payload.exp };
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
