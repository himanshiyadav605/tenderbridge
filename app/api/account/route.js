import { getCurrentUser } from "../../../lib/current-user";
import { jsonResult } from "../../../lib/http";

export async function GET() {
  const result = await getCurrentUser();

  if (result.sessionState === "expired") {
    return jsonResult({ error: "Your session has expired. Please sign in again." }, 401);
  }

  if (result.sessionState === "error") {
    return jsonResult(
      { error: "The service is temporarily unavailable. Please try again." },
      503
    );
  }

  if (!result.user) {
    return jsonResult({ error: "Authentication required." }, 401);
  }

  return jsonResult({
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
      createdAt: result.user.createdAt,
    },
  });
}
