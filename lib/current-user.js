import { cookies } from "next/headers";
import mongoose from "mongoose";
import connectDB from "./db";
import User from "../models/User";
import { readSession, SESSION_COOKIE } from "./session";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = readSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (session.state !== "ok") {
    return { user: null, sessionState: session.state };
  }

  if (!mongoose.isValidObjectId(session.sub)) {
    return { user: null, sessionState: "invalid" };
  }

  try {
    await connectDB();
    const record = await User.findById(session.sub).select("name email role createdAt");
    if (!record) {
      return { user: null, sessionState: "invalid" };
    }

    return {
      user: {
        id: record._id.toString(),
        name: record.name,
        email: record.email,
        role: record.role,
        createdAt: record.createdAt,
      },
      sessionState: "ok",
    };
  } catch {
    console.error("Failed to load the signed-in user from the database.");
    return { user: null, sessionState: "error" };
  }
}
