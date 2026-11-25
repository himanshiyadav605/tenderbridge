import connectDB from "../../../../lib/db";
import { hashPassword } from "../../../../lib/password";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "../../../../lib/session";
import { validateRegistration } from "../../../../lib/user-input";
import { isDuplicateKeyError, isSessionConfigError, jsonResult, readJsonBody } from "../../../../lib/http";
import User from "../../../../models/User";

export async function POST(request) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return jsonResult({ error: parsed.error }, 400);
  }

  const validation = validateRegistration(parsed.body);
  if (!validation.ok) {
    return jsonResult({ error: validation.error }, validation.status);
  }

  try {
    await connectDB();
    const passwordHash = await hashPassword(validation.password);
    const user = await User.create({
      name: validation.name,
      email: validation.email,
      passwordHash,
      role: "msme",
    });
    const token = createSessionToken(user._id.toString());
    const response = jsonResult({ ok: true }, 201);
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return jsonResult({ error: "An account with this email already exists." }, 409);
    }
    if (isSessionConfigError(error)) {
      console.error("Session signing is not configured.");
      return jsonResult({ error: "Authentication is not configured." }, 503);
    }
    console.error("Registration failed because the database could not be reached.");
    return jsonResult(
      { error: "The service is temporarily unavailable. Please try again." },
      503
    );
  }
}
