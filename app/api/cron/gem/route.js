import { NextResponse } from "next/server";
import connectDB from "../../../../lib/db.js";
import Tender from "../../../../models/Tender.js";
import {
  isAuthorizedCronRequest,
  syncGemTenders,
} from "../../../../lib/gem-ingestion.js";

export const runtime = "nodejs";

export { isAuthorizedCronRequest };

export async function GET(request) {
  if (!isAuthorizedCronRequest(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.APIFY_API_TOKEN) {
    return NextResponse.json(
      { error: "APIFY_API_TOKEN is not configured." },
      { status: 503 }
    );
  }

  try {
    await connectDB();
    const summary = await syncGemTenders(Tender, {
      token: process.env.APIFY_API_TOKEN,
    });
    return NextResponse.json(
      {
        ok: true,
        source: "GEM",
        ...summary,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "GeM ingestion failed.",
      },
      { status: 502 }
    );
  }
}
