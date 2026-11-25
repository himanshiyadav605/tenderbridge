const ACTOR_ENDPOINT =
  "https://api.apify.com/v2/acts/themineworks~india-tenders-scraper/run-sync-get-dataset-items";

export function isAuthorizedCronRequest(request, cronSecret) {
  if (!cronSecret) return false;
  const authorization = request.headers?.get("authorization") || "";
  return authorization === `Bearer ${cronSecret}`;
}

export function parseIsoDate(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeDaysToClose(value) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const numericValue = typeof value === "string" ? Number(value.trim()) : value;
  return typeof numericValue === "number" && Number.isFinite(numericValue)
    ? numericValue
    : null;
}

export function normalizeGemDocumentUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("//")) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    if (trimmed.startsWith("/")) {
      const resolved = new URL(trimmed, "https://bidplus.gem.gov.in");
      if (resolved.origin === "https://bidplus.gem.gov.in") {
        return resolved.toString();
      }
    }
  }

  return null;
}

function optionalString(row, keys) {
  for (const key of keys) {
    if (typeof row[key] === "string" && row[key].trim()) {
      return row[key].trim();
    }
  }
  return null;
}

function optionalBoolean(row, keys) {
  for (const key of keys) {
    if (typeof row[key] === "boolean") return row[key];
  }
  return null;
}

function optionalQuantity(row) {
  if (
    row.quantity !== null &&
    row.quantity !== undefined &&
    (typeof row.quantity === "string" ||
      typeof row.quantity === "number" ||
      typeof row.quantity === "boolean")
  ) {
    return row.quantity;
  }
  return null;
}

export function normalizeGemTender(row, fetchedAt = new Date()) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  if (row._type === "summary" || row._type === "info" || row._type === "error") return null;
  if (typeof row.source !== "string" || row.source.trim().toLowerCase() !== "gem") return null;

  const officialTenderId = optionalString(row, ["tender_id", "gem_bid_id", "reference_no"]);
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!officialTenderId || !title) return null;

  const daysToClose = normalizeDaysToClose(row.days_to_close);

  return {
    source: "GEM",
    recordType: "real",
    officialTenderId,
    externalId: optionalString(row, ["gem_bid_id", "tender_id", "reference_no"]),
    title,
    bidType: optionalString(row, ["bid_type", "tender_type"]),
    quantity: optionalQuantity(row),
    ministryOrState: optionalString(row, ["ministry_or_state", "organisation", "organization"]),
    department: optionalString(row, ["department"]),
    publishedAt: parseIsoDate(row.published_at),
    submissionDeadline: parseIsoDate(
      row.bid_submission_end_at || row.submission_deadline
    ),
    isHighValue: optionalBoolean(row, ["is_high_value", "isHighValue"]),
    isGlobalTender: optionalBoolean(row, ["is_global_tender", "isGlobalTender"]),
    isLimitedTender: optionalBoolean(row, ["is_limited_tender", "isLimitedTender"]),
    currency: optionalString(row, ["currency"]),
    documentUrl: normalizeGemDocumentUrl(optionalString(row, ["document_url"])),
    portalUrl: optionalString(row, ["portal_url", "gem_url"]),
    daysToClose,
    sourceFetchedAt: fetchedAt,
    lastSeenAt: fetchedAt,
    lastFetchedAt: fetchedAt,
  };
}

export async function fetchGemTenderRows({
  token,
  fetchImpl = fetch,
  timeoutMs = 120000,
} = {}) {
  if (!token) throw new Error("APIFY_API_TOKEN is required.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(
      `${ACTOR_ENDPOINT}?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: ["gem"],
          maxItems: 100,
          includeDetails: true,
          sortBy: "newest",
        }),
        signal: controller.signal,
      }
    );

    if (!response || !response.ok) {
      const status = response?.status ? ` HTTP ${response.status}` : "";
      throw new Error(`Apify GeM ingestion failed${status}.`);
    }

    let rows;
    try {
      rows = await response.json();
    } catch {
      if (controller.signal.aborted) {
        throw new Error("Apify GeM ingestion timed out.");
      }
      throw new Error("Apify returned invalid JSON.");
    }

    if (!Array.isArray(rows)) {
      throw new Error("Apify did not return a dataset array.");
    }

    return rows;
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncGemTenders(TenderModel, options = {}) {
  const rows = await fetchGemTenderRows(options);
  const fetchedAt = new Date();
  const summary = {
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const row of rows) {
    let normalized;
    try {
      normalized = normalizeGemTender(row, fetchedAt);
      if (!normalized) {
        summary.skipped++;
        continue;
      }

      summary.fetched++;
      const existing = await TenderModel.findOne({
        source: "GEM",
        officialTenderId: normalized.officialTenderId,
      }).select("_id firstSeenAt");

      const update = {
        $set: normalized,
        $setOnInsert: {
          firstSeenAt: existing?.firstSeenAt || fetchedAt,
        },
      };

      if (existing) {
        await TenderModel.updateOne(
          { _id: existing._id },
          update
        );
        summary.updated++;
      } else {
        await TenderModel.updateOne(
          { source: "GEM", officialTenderId: normalized.officialTenderId },
          update,
          { upsert: true }
        );
        summary.inserted++;
      }
    } catch {
      summary.failed++;
    }
  }

  return summary;
}
