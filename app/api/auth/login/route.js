import connectDB from "../../../../lib/db";
import { verifyAgainstStoredOrDummy } from "../../../../lib/password";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "../../../../lib/session";
import { validateLogin } from "../../../../lib/user-input";
import { isSessionConfigError, jsonResult, readJsonBody } from "../../../../lib/http";
import User from "../../../../models/User";

export async function POST(request) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return jsonResult({ error: parsed.error }, 400);
  }

  const validation = validateLogin(parsed.body);
  if (!validation.ok) {
    return jsonResult({ error: validation.error }, validation.status);
  }

  try {
    await connectDB();
    const user = await User.findOne({ email: validation.email }).select(
      "name email role passwordHash"
    );
    const passwordMatches = await verifyAgainstStoredOrDummy(
      validation.password,
      user ? user.passwordHash : ""
    );

    if (!user || !passwordMatches) {
      return jsonResult({ error: "Invalid email or password." }, 401);
    }

    const token = createSessionToken(user._id.toString());
    const response = jsonResult({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (isSessionConfigError(error)) {
      console.error("Session signing is not configured.");
      return jsonResult({ error: "Authentication is not configured." }, 503);
    }
    console.error("Sign-in failed because the database could not be reached.");
    return jsonResult(
      { error: "The service is temporarily unavailable. Please try again." },
      503
    );
  }
}
