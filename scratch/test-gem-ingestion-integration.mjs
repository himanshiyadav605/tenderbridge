import assert from "node:assert/strict";
import mongoose from "mongoose";
import connectDB, {
  getMongoDatabaseName,
  resolveMongoUri,
} from "../lib/db.js";
import Tender from "../models/Tender.js";
import { DEMO_TENDERS } from "../data/tenders.js";
import { syncGemTenders } from "../lib/gem-ingestion.js";
import {
  encodeGemInternalId,
  getCatalogueTenderById,
  mapGemTender,
} from "../lib/tender-data.js";
import {
  configureIntegrationTestDatabase,
  createIntegrationRunId,
} from "./integration-test-setup.mjs";

function formatDatabaseName(uri) {
  return getMongoDatabaseName(uri);
}

async function runTestSuite() {
  configureIntegrationTestDatabase();
  const databaseName = formatDatabaseName(resolveMongoUri());
  assert.equal(databaseName, "tenderbridge_test");

  const runId = createIntegrationRunId();
  const officialTenderId = `GEM/INTEGRATION-TEST-${runId}`;
  const demoSnapshot = JSON.stringify(DEMO_TENDERS);
  let passed = 0;
  let failed = 0;

  const test = async (name, operation) => {
    try {
      await operation();
      passed++;
      console.log(`[PASS] ${name}`);
    } catch (error) {
      failed++;
      console.error(`[FAIL] ${name}: ${error.message}`);
      throw error;
    }
  };

  try {
    await test("Insert synthetic GeM tender", async () => {
      await connectDB();
      await Tender.deleteOne({ source: "GEM", officialTenderId });

      const summary = await syncGemTenders(Tender, {
        token: "not-used-in-this-test",
        fetchImpl: async () => ({
          ok: true,
          json: async () => [
            {
              source: "gem",
              tender_id: officialTenderId,
              gem_bid_id: officialTenderId,
              title: "Synthetic GeM integration tender",
              bid_type: "BID",
              quantity: 25,
              ministry_or_state: "Synthetic Ministry",
              department: "Synthetic Department",
              published_at: "2026-11-25T09:30:00+05:30",
              bid_submission_end_at: "2026-12-25T15:00:00+05:30",
              is_high_value: false,
              is_global_tender: false,
              is_limited_tender: true,
              currency: "INR",
              document_url: "https://example.invalid/synthetic-document",
              portal_url: "https://example.invalid/synthetic-portal",
              days_to_close: 30,
            },
          ],
        }),
      });

      assert.equal(summary.inserted, 1);
      assert.equal(summary.updated, 0);
      assert.equal(summary.failed, 0);
    });

    let firstSeenAt;

    await test("Retrieve and map the inserted tender", async () => {
      const record = await Tender.findOne({
        source: "GEM",
        officialTenderId,
      }).lean();

      assert.ok(record);
      assert.equal(record.title, "Synthetic GeM integration tender");
      firstSeenAt = record.firstSeenAt;
      assert.ok(firstSeenAt instanceof Date);

      const mapped = mapGemTender(record);
      assert.equal(mapped.officialTenderId, officialTenderId);
      assert.equal(mapped.id, encodeGemInternalId(officialTenderId));
      assert.equal(mapped.id.includes("/"), false);
    });

    await test("Retrieve the tender through the encoded catalogue ID", async () => {
      const internalId = encodeGemInternalId(officialTenderId);
      const record = await getCatalogueTenderById(internalId);
      assert.ok(record);
      assert.equal(record.officialTenderId, officialTenderId);
      assert.equal(record.id, internalId);
    });

    await test("Update the same tender without replacing firstSeenAt", async () => {
      const beforeUpdate = await Tender.findOne({
        source: "GEM",
        officialTenderId,
      }).lean();

      const summary = await syncGemTenders(Tender, {
        token: "not-used-in-this-test",
        fetchImpl: async () => ({
          ok: true,
          json: async () => [
            {
              source: "gem",
              tender_id: officialTenderId,
              gem_bid_id: officialTenderId,
              title: "Updated synthetic GeM integration tender",
              bid_type: "RFA",
              quantity: 50,
              ministry_or_state: "Updated Synthetic Ministry",
              department: undefined,
              published_at: "2026-11-26T10:30:00+05:30",
              bid_submission_end_at: "2026-12-26T16:00:00+05:30",
              is_high_value: true,
              is_global_tender: false,
              is_limited_tender: false,
              currency: "INR",
              document_url: "/showradocumentPdf/10215316",
              portal_url: "https://example.invalid/updated-portal",
              days_to_close: 30,
            },
          ],
        }),
      });

      assert.equal(summary.updated, 1);
      assert.equal(summary.inserted, 0);
      assert.equal(summary.failed, 0);

      const updated = await Tender.findOne({
        source: "GEM",
        officialTenderId,
      }).lean();
      assert.equal(updated.title, "Updated synthetic GeM integration tender");
      assert.equal(updated.department, null);
      assert.equal(updated.ministryOrState, "Updated Synthetic Ministry");
      assert.equal(updated.quantity, 50);
      assert.equal(updated.isHighValue, true);
      assert.equal(updated.documentUrl, "https://bidplus.gem.gov.in/showradocumentPdf/10215316");
      assert.equal(updated.firstSeenAt.getTime(), beforeUpdate.firstSeenAt.getTime());
      assert.equal(updated.firstSeenAt.getTime(), firstSeenAt.getTime());
    });

    await test("Record persists after disconnecting and reopening", async () => {
      await mongoose.disconnect();
      await connectDB();

      const record = await Tender.findOne({
        source: "GEM",
        officialTenderId,
      }).lean();
      assert.ok(record);
      assert.equal(record.title, "Updated synthetic GeM integration tender");
    });

    await test("Existing DEMO_TENDERS remain unchanged", () => {
      assert.equal(JSON.stringify(DEMO_TENDERS), demoSnapshot);
    });

    console.log(`[Database] tenderbridge_test (${databaseName})`);
  } catch {
    console.error("[FAIL] GeM MongoDB integration suite aborted.");
  } finally {
    let deleted = 0;
    try {
      await connectDB();
      const cleanup = await Tender.deleteOne({
        source: "GEM",
        officialTenderId,
      });
      deleted = cleanup.deletedCount || 0;
      console.log(`[Cleanup] Synthetic GeM record deleted: ${deleted}`);
    } catch (error) {
      failed++;
      console.error(`[Cleanup] Failed to delete synthetic GeM record: ${error.message}`);
    } finally {
      await mongoose.disconnect();
    }

    console.log(`[Summary] Passed=${passed} Failed=${failed} CleanupDeleted=${deleted}`);
    if (failed > 0 || deleted !== 1) {
      process.exitCode = 1;
    }
  }
}

runTestSuite().catch((error) => {
  console.error(`[Fatal] ${error.message}`);
  process.exitCode = 1;
});
