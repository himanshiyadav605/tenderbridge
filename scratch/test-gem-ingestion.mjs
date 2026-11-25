import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchGemTenderRows,
  isAuthorizedCronRequest,
  normalizeDaysToClose,
  normalizeGemTender,
  syncGemTenders,
} from "../lib/gem-ingestion.js";
import {
  decodeGemInternalId,
  encodeGemInternalId,
  getCatalogueTenderById,
  mapGemTender,
  normalizeGemDocumentUrl,
} from "../lib/tender-data.js";
import { DEMO_TENDERS } from "../data/tenders.js";

describe("GeM detail routing IDs", () => {
  it("encodes an official ID containing multiple slashes as one URL-safe segment", () => {
    const officialTenderId = "GEM/2026/R/776986";
    const mapped = mapGemTender({
      source: "GEM",
      recordType: "real",
      officialTenderId,
      title: "High value bid",
    });

    assert.equal(mapped.officialTenderId, officialTenderId);
    assert.match(mapped.id, /^gem-[A-Za-z0-9_-]+$/);
    assert.equal(mapped.id.includes("/"), false);
    assert.equal(decodeGemInternalId(mapped.id), officialTenderId);
  });

  it("looks up the original official ID using the encoded internal ID", async () => {
    const officialTenderId = "GEM/2026/R/776986";
    const internalId = encodeGemInternalId(officialTenderId);
    let lookup;

    const result = await getCatalogueTenderById(internalId, {
      connectDB: async () => {},
      TenderModel: {
        findOne: (filter) => {
          lookup = filter;
          return {
            lean: async () => ({
              source: "GEM",
              recordType: "real",
              officialTenderId,
              title: "High value bid",
            }),
          };
        },
      },
    });

    assert.deepEqual(lookup, { source: "GEM", officialTenderId });
    assert.equal(result.officialTenderId, officialTenderId);
    assert.equal(result.id, internalId);
  });

  it("returns undefined for an invalid encoded GeM ID", async () => {
    assert.equal(await getCatalogueTenderById("gem-not!valid"), undefined);
    assert.equal(await getCatalogueTenderById("gem-%%%%"), undefined);
  });

  it("continues to resolve existing static tender IDs", async () => {
    const tender = await getCatalogueTenderById("tnd-007");
    assert.equal(tender.id, "tnd-007");
  });
});

describe("GeM tender normalization", () => {
  it("normalizes days_to_close without converting missing values to zero", () => {
    assert.equal(normalizeDaysToClose(null), null);
    assert.equal(normalizeDaysToClose(undefined), null);
    assert.equal(normalizeDaysToClose(""), null);
    assert.equal(normalizeDaysToClose("   "), null);
    assert.equal(normalizeDaysToClose(0), 0);
    assert.equal(normalizeDaysToClose(-2), -2);
    assert.equal(normalizeDaysToClose("12"), 12);
  });

  it("keeps department separate from ministry/state", () => {
    const mapped = mapGemTender({
      source: "GEM",
      recordType: "real",
      officialTenderId: "GEM/DEPARTMENT-TEST",
      title: "Department mapping test",
      ministryOrState: "Ministry of Test",
      department: null,
    });

    assert.equal(mapped.department, null);
    assert.equal(mapped.ministryOrState, "Ministry of Test");
  });

  it("normalizes relative and preserves absolute document URLs", () => {
    assert.equal(normalizeGemDocumentUrl("//attacker.example/document.pdf"), null);
    assert.equal(
      normalizeGemDocumentUrl("/showradocumentPdf/10215316"),
      "https://bidplus.gem.gov.in/showradocumentPdf/10215316"
    );
    assert.equal(
      normalizeGemDocumentUrl("https://mkp.gem.gov.in/document.pdf"),
      "https://mkp.gem.gov.in/document.pdf"
    );
    assert.equal(
      normalizeGemDocumentUrl("http://mkp.gem.gov.in/document.pdf"),
      "http://mkp.gem.gov.in/document.pdf"
    );
  });

  it("normalizes valid GeM records", () => {
    const normalized = normalizeGemTender({
      source: "gem",
      tender_id: "GEM/2026/B/123",
      gem_bid_id: "GEM/2026/B/123",
      title: "Supply of agricultural testing kits",
      bid_type: "BID",
      quantity: 150,
      ministry_or_state: "Ministry of Agriculture",
      department: "Agriculture Department",
      published_at: "2026-11-24T09:30:00+05:30",
      bid_submission_end_at: "2026-11-30T15:00:00+05:30",
      is_high_value: false,
      is_global_tender: false,
      is_limited_tender: true,
      currency: "INR",
      document_url: "https://mkp.gem.gov.in/document.pdf",
      portal_url: "https://bidplus.gem.gov.in/bidding/bid/showbid/123",
      days_to_close: 7,
    });

    assert.equal(normalized.source, "GEM");
    assert.equal(normalized.recordType, "real");
    assert.equal(normalized.officialTenderId, "GEM/2026/B/123");
    assert.equal(normalized.title, "Supply of agricultural testing kits");
    assert.ok(normalized.publishedAt instanceof Date);
    assert.ok(normalized.submissionDeadline instanceof Date);
  });

  it("keeps missing optional fields null", () => {
    const normalized = normalizeGemTender({
      source: "gem",
      tender_id: "GEM/EMPTY",
      title: "Limited bid",
    });

    assert.equal(normalized.department, null);
    assert.equal(normalized.ministryOrState, null);
    assert.equal(normalized.documentUrl, null);
    assert.equal(normalized.publishedAt, null);
  });

  it("rejects invalid tender IDs", () => {
    assert.equal(normalizeGemTender({ source: "gem", tender_id: "", title: "Bid" }), null);
    assert.equal(normalizeGemTender({ source: "gem", tender_id: "   ", title: "Bid" }), null);
  });

  it("filters summary, info, error, and non-GeM rows", () => {
    assert.equal(normalizeGemTender({ source: "gem", _type: "summary", tender_id: "A", title: "A" }), null);
    assert.equal(normalizeGemTender({ source: "gem", _type: "info", tender_id: "A", title: "A" }), null);
    assert.equal(normalizeGemTender({ source: "gem", _type: "error", tender_id: "A", title: "A" }), null);
    assert.equal(normalizeGemTender({ source: "central", tender_id: "A", title: "A" }), null);
  });
});

describe("GeM ingestion and sync", () => {
  it("keeps the timeout active while the response body is parsing", async () => {
    await assert.rejects(
      fetchGemTenderRows({
        token: "test-token",
        timeoutMs: 10,
        fetchImpl: async (_url, init) => ({
          ok: true,
          status: 200,
          json: () =>
            new Promise((resolve, reject) => {
              init.signal.addEventListener("abort", () => {
                reject(new Error("body aborted"));
              });
            }),
        }),
      }),
      /timed out/
    );
  });

  it("requests an array and rejects upstream failures", async () => {
    await assert.rejects(
      fetchGemTenderRows({
        token: "test-token",
        fetchImpl: async () => ({ ok: false, status: 500 }),
      }),
      /HTTP 500/
    );

    await assert.rejects(
      fetchGemTenderRows({
        token: "test-token",
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ not: "an array" }),
        }),
      }),
      /dataset array/
    );
  });

  it("updates an existing record and preserves firstSeenAt", async () => {
    const firstSeenAt = new Date("2026-11-01T00:00:00Z");
    let updatePayload;
    const TenderModel = {
      findOne: () => ({
        select: async () => ({ _id: "existing-id", firstSeenAt }),
      }),
      updateOne: async (_filter, payload) => {
        updatePayload = payload;
      },
    };

    const summary = await syncGemTenders(TenderModel, {
      token: "test-token",
      fetchImpl: async () => ({
        ok: true,
        json: async () => [{
          source: "gem",
          tender_id: "GEM/UPDATE",
          title: "Updated bid title",
          department: "Updated department",
        }],
      }),
    });

    assert.equal(summary.updated, 1);
    assert.equal(summary.inserted, 0);
    assert.equal(updatePayload.$set.title, "Updated bid title");
  });

  it("inserts a new record without deleting historical records", async () => {
    let filter;
    let payload;
    const TenderModel = {
      findOne: () => ({ select: async () => null }),
      updateOne: async (receivedFilter, receivedPayload) => {
        filter = receivedFilter;
        payload = receivedPayload;
      },
    };

    const summary = await syncGemTenders(TenderModel, {
      token: "test-token",
      fetchImpl: async () => ({
        ok: true,
        json: async () => [{
          source: "gem",
          tender_id: "GEM/NEW",
          title: "New bid",
        }],
      }),
    });

    assert.equal(summary.inserted, 1);
    assert.deepEqual(filter, { source: "GEM", officialTenderId: "GEM/NEW" });
    assert.equal(payload.$setOnInsert.firstSeenAt instanceof Date, true);
  });

  it("rejects unauthorized cron requests", () => {
    const request = { headers: new Headers({ authorization: "Bearer wrong" }) };
    assert.equal(isAuthorizedCronRequest(request, "correct-secret"), false);

    const authorized = { headers: new Headers({ authorization: "Bearer correct-secret" }) };
    assert.equal(isAuthorizedCronRequest(authorized, "correct-secret"), true);
  });

  it("does not alter demo records or invent GeM eligibility", () => {
    const before = JSON.stringify(DEMO_TENDERS);
    const mapped = mapGemTender({
      source: "GEM",
      recordType: "real",
      officialTenderId: "GEM/TEST",
      title: "GeM test bid",
      department: null,
      ministryOrState: null,
      publishedAt: null,
      submissionDeadline: null,
      lastFetchedAt: new Date("2026-11-25T00:00:00Z"),
    });

    assert.equal(JSON.stringify(DEMO_TENDERS), before);
    assert.deepEqual(mapped.eligibilityRequirements, []);
    assert.equal(mapped.category, null);
    assert.equal(mapped.location, null);
    assert.equal(mapped.estimatedValue, null);
  });
});
