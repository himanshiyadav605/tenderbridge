import { NextResponse } from "next/server";

export function jsonResult(body, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function readJsonBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, error: "Invalid request." };
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { ok: false, error: "Invalid request." };
    }
    return { ok: true, body };
  } catch {
    return { ok: false, error: "Invalid request." };
  }
}

export function isDuplicateKeyError(error) {
  return Boolean(error && (error.code === 11000 || error.code === 11001));
}

export function isSessionConfigError(error) {
  return Boolean(error && error.code === "SESSION_SECRET_MISSING");
}
