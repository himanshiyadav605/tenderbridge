/**
 * ============================================================================
 * TenderBridge - Database-to-Tender-Matching Integration Test
 * ============================================================================
 *
 * This test suite validates the complete end-to-end flow:
 *  1. Register a synthetic test user via POST /api/auth/register.
 *  2. Capture the HTTP session cookie (tb_session).
 *  3. Create an MSME company profile via POST /api/profile.
 *  4. Retrieve the persisted profile via GET /api/profile.
 *  5. Adapt the actual saved profile using adaptProfileForMatching().
 *  6. Evaluate the adapted profile against the real tnd-007 tender using evaluateTenderMatch().
 *  7. Verify all initial criterion statuses and the overall "Needs Verification" status.
 *  8. Update a relevant profile field (departmentalEnlistments) via PUT /api/profile.
 *  9. Retrieve the updated profile via GET /api/profile and re-run evaluateTenderMatch().
 * 10. Confirm the evaluation diagnostics reflect the persisted change while honestly
 *     preserving the "Needs Verification" overall result (unverified self-declared data).
 * 11. Clean up only the synthetic test user's profile and account in a finally block.
 *
 * Rules:
 *  - Uses Node.js native fetch() and existing project dependencies.
 *  - No mocked data; starts a local Next.js server and uses TEST_MONGODB_URI.
 *  - Does not mark data as verified or directly edit verification statuses in MongoDB.
 *  - Verifies account ownership before cleanup.
 *  - Never logs passwords, session tokens, or sensitive credentials.
 */

import mongoose from "mongoose";
import connectDB from "../lib/db.js";
import User from "../models/User.js";
import MsmeProfile from "../models/MsmeProfile.js";
import { DEMO_TENDERS } from "../data/tenders.js";
import { adaptProfileForMatching } from "../lib/profile-to-matching.js";
import { evaluateTenderMatch } from "../lib/tender-matching.js";
import {
  captureCreatedUserId,
  cleanupCreatedUser,
  createIntegrationRunId,
  startIntegrationTestServer,
} from "./integration-test-setup.mjs";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message, details = "") {
  if (!condition) {
    const errorMsg = `Assertion Failed: ${message}${details ? ` (${details})` : ""}`;
    throw new Error(errorMsg);
  }
}

function extractSessionCookie(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return null;
  const match = setCookie.match(/tb_session=[^;]+/);
  return match ? match[0] : null;
}

async function runTestSuite() {
  console.log("=================================================================");
  console.log("   TenderBridge Integration Test: Database to Tender Matching");
  console.log("=================================================================");

  const runId = createIntegrationRunId();
  const testUserEmail = `test-matching-user-${runId}@example.com`;
  const defaultPassword = `MatchPass#${runId}!`;

  let sessionCookie = null;
  let createdUserId = null;

  // Retrieve actual tender tnd-007 from DEMO_TENDERS
  const tenderTnd007 = DEMO_TENDERS.find((t) => t.id === "tnd-007");
  assert(Boolean(tenderTnd007), "Tender tnd-007 must exist in data/tenders.js");

  // Initial synthetic MSME profile payload without enlistments
  const initialProfilePayload = {
    legalName: `Himalayan Defence Works Pvt Ltd (Run ${runId})`,
    tradeName: "Himalayan Defence Works",
    udyamRegistrationNumber: `UDYAM-AR-${String(runId).slice(-7)}`,
    msmeCategory: "Small",
    constitutionType: "Private Limited",
    industry: "Artificers Works & Maintenance",
    businessDescription: "Civil engineering maintenance services in high-altitude zones.",
    registeredAddress: "Sector 3, Tenga Valley",
    city: "West Kameng",
    state: "Arunachal Pradesh",
    pincode: "790115",
    contactPerson: "Tsering Norbu",
    contactPhone: "+91 9436055443",
    contactEmail: testUserEmail,
    businessWebsite: "https://himalayandefence-test.local",
    departmentalEnlistments: [],
  };

  // Update payload adding a valid DCW&E Class I Composite Category enlistment
  const updatePayload = {
    departmentalEnlistments: [
      {
        authority: "DCW&E",
        registrationClass: "Class I",
        registrationNumber: `DCWE/COMP/${runId}/089`,
        validityStartDate: "2025-01-01",
        validityEndDate: "2028-12-31",
      },
    ],
  };

  console.log("\n[Planned Test Data]");
  console.log(`- Synthetic Account Email : ${testUserEmail}`);
  console.log(`- Target Tender ID        : ${tenderTnd007.id} (${tenderTnd007.title.slice(0, 50)}...)`);
  console.log(`- Initial Profile Enlistments: None (empty array)`);
  console.log(`- Updated Profile Enlistment : DCW&E Class I (Composite Category)`);

  console.log("\n[Expected Evaluation Results]");
  console.log("- Initial Evaluation: All 5 criteria and Overall Status = 'Needs Verification' due to unverified/missing data.");
  console.log("- After Profile Update: Evaluation detects DCW&E registration; diagnostic notes DRDO-2024 BIM is still required.");
  console.log("- Overall Status after update remains 'Needs Verification' because unverified self-declared data cannot pass mandatory gates.");

  console.log("\n[Planned Cleanup Behavior]");
  console.log(`- Uses the User ID captured for this run and its generated email: ${testUserEmail}`);
  console.log("- Deletes only profiles linked to that captured User ID and that User record.");
  console.log("- Real company profiles and unrelated accounts remain untouched.");

  const integrationServer = await startIntegrationTestServer();
  const BASE_URL = integrationServer.baseUrl;
  console.log(`Target Server: ${BASE_URL}`);

  try {
    // -------------------------------------------------------------------------
    // Pre-flight Server Check
    // -------------------------------------------------------------------------
    console.log("\n[Pre-flight] Checking server accessibility...");
    try {
      const probeRes = await fetch(`${BASE_URL}/`, { method: "GET" });
      console.log(`[Pre-flight] Server responded with status ${probeRes.status}.`);
    } catch (err) {
      throw new Error(`Cannot connect to server at ${BASE_URL}. Ensure Next.js is running. Details: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // STEP 1 & 2: Register Synthetic User & Capture Session Cookie
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- STEP 1 & 2: Register Synthetic User & Capture Cookie ---");
    console.log(`Registering user: ${testUserEmail}`);
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Matching User",
        email: testUserEmail,
        password: defaultPassword,
      }),
    });

    const regBody = await regRes.json();
    assert(regRes.status === 201, "Registration HTTP status must be 201", `got ${regRes.status}`);
    assert(regBody.ok === true, "Registration response must be { ok: true }");

    createdUserId = await captureCreatedUserId(User, testUserEmail);
    sessionCookie = extractSessionCookie(regRes);
    assert(Boolean(sessionCookie), "Session cookie (tb_session) must be present in response headers");
    console.log("  [+] Registration succeeded (HTTP 201) and session cookie captured.");
    passedTests++;

    // -------------------------------------------------------------------------
    // STEP 3: Create MSME Profile via POST /api/profile
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- STEP 3: Create MSME Profile (POST /api/profile) ---");
    console.log(`Submitting profile: legalName="${initialProfilePayload.legalName}"`);
    const createRes = await fetch(`${BASE_URL}/api/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify(initialProfilePayload),
    });

    const createBody = await createRes.json();
    assert(createRes.status === 201, "Profile creation HTTP status must be 201", `got ${createRes.status}`);
    assert(createBody.profile, "Response must include profile object");
    assert(
      String(createBody.profile.userId) === createdUserId,
      "Created profile must belong to the user registered by this run"
    );
    console.log(`  [+] Profile created with ID: ${createBody.profile._id}`);
    passedTests++;

    // -------------------------------------------------------------------------
    // STEP 4, 5, 6, 7: Retrieve Profile, Adapt, and Evaluate Against tnd-007
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- STEP 4, 5, 6, 7: Retrieve Profile & Evaluate Against tnd-007 ---");
    const getRes1 = await fetch(`${BASE_URL}/api/profile`, {
      method: "GET",
      headers: { Cookie: sessionCookie },
    });

    const getBody1 = await getRes1.json();
    assert(getRes1.status === 200, "GET /api/profile HTTP status must be 200", `got ${getRes1.status}`);
    assert(getBody1.profile !== null, "GET response must include profile object");

    // Adapt saved profile for matching
    const savedProfile1 = getBody1.profile;
    const adaptedProfile1 = adaptProfileForMatching(savedProfile1);
    assert(adaptedProfile1 !== null, "adaptProfileForMatching() must return an adapted object");

    // Evaluate against tnd-007
    const matchResult1 = evaluateTenderMatch(tenderTnd007, adaptedProfile1);
    console.log(`  [+] Overall Match Status : "${matchResult1.overallStatus}"`);

    // Verify expected overall status
    assert(
      matchResult1.overallStatus === "Needs Verification",
      "Initial overall status must be 'Needs Verification'",
      `got "${matchResult1.overallStatus}"`
    );

    // Verify individual criteria statuses
    console.log("  [+] Detailed Criteria Evaluations:");
    for (const c of matchResult1.criteriaResults) {
      console.log(`      - [${c.status.toUpperCase()}] ${c.criteriaKey}: ${c.reason?.slice(0, 90)}...`);
      assert(
        c.status === "needs_verification",
        `Criterion ${c.criteriaKey} must have status 'needs_verification'`,
        `got "${c.status}"`
      );
    }

    const initialEnlistmentCriterion = matchResult1.criteriaResults.find(
      (c) => c.criteriaKey === "departmentalEnlistment"
    );
    assert(
      initialEnlistmentCriterion.reason.includes("Neither DCW&E Composite nor DRDO-2024 BIM registrations are declared") ||
        initialEnlistmentCriterion.reason.includes("no registration records found"),
      "Initial enlistment reason must indicate missing DCW&E / DRDO registrations",
      `got "${initialEnlistmentCriterion.reason}"`
    );
    console.log("  [+] Initial criteria statuses and overall 'Needs Verification' verified.");
    passedTests++;

    // -------------------------------------------------------------------------
    // STEP 8: Update Relevant Profile Field (departmentalEnlistments) via PUT /api/profile
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- STEP 8: Update Departmental Enlistment via PUT /api/profile ---");
    console.log("Sending update payload with DCW&E Class I registration...");
    const putRes = await fetch(`${BASE_URL}/api/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify(updatePayload),
    });

    const putBody = await putRes.json();
    assert(putRes.status === 200, "Profile PUT HTTP status must be 200", `got ${putRes.status}`);
    assert(putBody.profile, "PUT response must return updated profile object");
    assert(
      Array.isArray(putBody.profile.departmentalEnlistments) &&
        putBody.profile.departmentalEnlistments.length === 1,
      "Profile must have 1 departmental enlistment after update"
    );
    console.log("  [+] PUT /api/profile returned HTTP 200 confirming enlistment update.");
    passedTests++;

    // -------------------------------------------------------------------------
    // STEP 9 & 10: Retrieve Updated Profile & Confirm Matching Engine Response
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- STEP 9 & 10: Retrieve Updated Profile & Re-evaluate ---");
    const getRes2 = await fetch(`${BASE_URL}/api/profile`, {
      method: "GET",
      headers: { Cookie: sessionCookie },
    });

    const getBody2 = await getRes2.json();
    assert(getRes2.status === 200, "GET /api/profile HTTP status must be 200", `got ${getRes2.status}`);

    const savedProfile2 = getBody2.profile;
    assert(
      Array.isArray(savedProfile2.departmentalEnlistments) &&
        savedProfile2.departmentalEnlistments.length === 1,
      "Persisted profile must contain the updated departmental enlistment"
    );

    // Re-adapt and re-evaluate
    const adaptedProfile2 = adaptProfileForMatching(savedProfile2);
    const matchResult2 = evaluateTenderMatch(tenderTnd007, adaptedProfile2);

    console.log(`  [+] Re-evaluated Overall Match Status: "${matchResult2.overallStatus}"`);

    // Verify how the evaluation reflected the persisted change
    const updatedEnlistmentCriterion = matchResult2.criteriaResults.find(
      (c) => c.criteriaKey === "departmentalEnlistment"
    );

    console.log("  [+] Updated Enlistment Criterion Diagnostic:");
    console.log(`      Reason: "${updatedEnlistmentCriterion.reason}"`);

    // The diagnostic must reflect the persisted DCW&E registration:
    // It detects DCW&E and now specifically points out that DRDO-2024 BIM registration is missing.
    assert(
      updatedEnlistmentCriterion.reason.includes("DRDO-2024 BIM registration not declared"),
      "Evaluation must reflect the persisted DCW&E enlistment and identify missing DRDO-2024 BIM registration",
      `got "${updatedEnlistmentCriterion.reason}"`
    );

    // Honestly verify that overall status remains 'Needs Verification':
    // Self-declared information cannot legally transition to 'Eligible' without verification.
    assert(
      matchResult2.overallStatus === "Needs Verification",
      "Overall status must remain 'Needs Verification' because self-declared evidence is unverified",
      `got "${matchResult2.overallStatus}"`
    );
    console.log("  [+] Confirmed: Evaluation accurately reflects the persisted change without manufacturing a false transition.");
    passedTests++;

  } catch (err) {
    failedTests++;
    console.error(`\n[FAIL] Test suite failed: ${err.message}`);
  } finally {
    // -------------------------------------------------------------------------
    // STEP 11: Clean up only the synthetic user's profile and account
    // -------------------------------------------------------------------------
    console.log("\n=================================================================");
    console.log("   STEP 11: Safe Database Cleanup");
    console.log("=================================================================");

    try {
      await connectDB();
      console.log("[Cleanup] Connected to MongoDB.");

      // Strict ownership check: ensure email matches synthetic test pattern
      if (!testUserEmail.startsWith("test-matching-user-")) {
        throw new Error(`Aborting cleanup: email "${testUserEmail}" does not match test pattern.`);
      }

      const cleanup = await cleanupCreatedUser(
        User,
        MsmeProfile,
        createdUserId,
        testUserEmail
      );
      console.log(`[Cleanup] Deleted ${cleanup.deletedProfiles} associated profile document(s).`);
      console.log(`[Cleanup] Deleted ${cleanup.deletedUser} user document.`);

      console.log("[Cleanup] Completed successfully. Real data was not modified.");
    } catch (cleanupError) {
      failedTests++;
      console.error("[Cleanup Error] Failed to complete database cleanup:", cleanupError.message);
    } finally {
      try {
        await mongoose.disconnect();
        console.log("[Cleanup] MongoDB connection closed.");
      } finally {
        await integrationServer.stop();
      }
    }

    // -------------------------------------------------------------------------
    // Final Summary
    // -------------------------------------------------------------------------
    console.log("\n=================================================================");
    console.log("                      TEST SUMMARY");
    console.log("=================================================================");
    console.log(`Total Workflows Tested : ${totalTests}`);
    console.log(`Passed                 : ${passedTests}`);
    console.log(`Failed                 : ${failedTests}`);
    console.log("=================================================================\n");

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTestSuite().catch((error) => {
  console.error("[Fatal] Integration-test setup failed:", error.message);
  process.exitCode = 1;
});
