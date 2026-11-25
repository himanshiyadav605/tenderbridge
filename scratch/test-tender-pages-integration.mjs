/**
 * ============================================================================
 * TenderBridge - Tender Pages UI Integration Test (/tenders & /tenders/tnd-007)
 * ============================================================================
 *
 * This test suite validates Server-Side Rendered (SSR) UI integration for:
 *  1. Registering a synthetic user via POST /api/auth/register.
 *  2. Creating a persistent MSME profile via POST /api/profile.
 *  3. Requesting GET /tenders with the session cookie.
 *  4. Verifying /tenders contains tnd-007 and its personalized eligibility badge.
 *  5. Requesting GET /tenders/tnd-007 with the session cookie.
 *  6. Verifying /tenders/tnd-007 contains the personalized match section and status.
 *  7. Confirming both pages identify the exact same company legalName.
 *  8. Confirming both pages display "Needs Verification" for this self-declared profile.
 *  9. Cleaning up only the synthetic test user and profile in a finally block.
 *
 * Implementation rules:
 *  - Uses Node.js native fetch() without external test frameworks or browser automation.
 *  - Starts a local Next.js server and inspects its rendered HTML.
 *  - Safe cleanup verifying account ownership before deletion.
 *  - Sensitive values (passwords, session cookies) are never logged.
 */

import mongoose from "mongoose";
import connectDB from "../lib/db.js";
import User from "../models/User.js";
import MsmeProfile from "../models/MsmeProfile.js";
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

/**
 * Helper: Extract the personalized eligibility status for tnd-007 from /tenders HTML.
 * The card contains `href="/tenders/tnd-007"` and `Your Eligibility:`.
 */
function extractListingTnd007Status(html) {
  // Find article or section for tnd-007
  const tndIndex = html.indexOf('/tenders/tnd-007');
  if (tndIndex === -1) return null;

  // Search within the vicinity of the tnd-007 card (next 2500 characters)
  const cardSnippet = html.slice(tndIndex, tndIndex + 2500);
  const eligibilityMatch = cardSnippet.match(/Your (?:Profile Match|Eligibility):<\/span>\s*<span[^>]*>\s*([^<]+)\s*<\/span>/i);
  return eligibilityMatch ? eligibilityMatch[1].trim() : null;
}

/**
 * Helper: Extract the personalized match overall status from /tenders/tnd-007 detail HTML.
 */
function extractDetailMatchStatus(html) {
  const matchSectionIndex = html.indexOf("Personalized Tender Match");
  if (matchSectionIndex === -1) return null;

  // Search within the Personalized Tender Match block (next 1200 characters)
  const sectionSnippet = html.slice(matchSectionIndex, matchSectionIndex + 1200);
  const statusMatch = sectionSnippet.match(/<span class="inline-block rounded-full border[^"]*"[^>]*>\s*([^<]+)\s*<\/span>/i);
  return statusMatch ? statusMatch[1].trim() : null;
}

async function runTestSuite() {
  console.log("=================================================================");
  console.log("   TenderBridge Integration Test: Tender Pages UI (/tenders)");
  console.log("=================================================================");

  const runId = createIntegrationRunId();
  const testUserEmail = `test-ui-user-${runId}@example.com`;
  const defaultPassword = `UiPass#${runId}!`;
  const companyLegalName = `Highland Artificer Works Pvt Ltd (Run ${runId})`;

  let sessionCookie = null;
  let createdUserId = null;

  const syntheticProfile = {
    legalName: companyLegalName,
    tradeName: "Highland Artificer Works",
    udyamRegistrationNumber: `UDYAM-AR-${String(runId).slice(-7)}`,
    msmeCategory: "Small",
    constitutionType: "Private Limited",
    industry: "Artificers Works & Maintenance",
    businessDescription: "Civil engineering and structural artificer maintenance services.",
    registeredAddress: "Plot 88, Border Roads Enclave",
    city: "Tawang",
    state: "Arunachal Pradesh",
    pincode: "790104",
    contactPerson: "Lobsang Wangdi",
    contactPhone: "+91 9436022334",
    contactEmail: testUserEmail,
    businessWebsite: "https://highlandworks-test.local",
  };

  console.log("\n[Planned Test Account & Profile Data]");
  console.log(`- Synthetic Account Email: ${testUserEmail}`);
  console.log(`- Company Legal Name     : ${companyLegalName}`);
  console.log(`- Target Tender ID       : tnd-007`);
  console.log("- Expected Eligibility   : Needs Verification (both on catalogue and detail page)");

  console.log("\n[Planned Cleanup Behavior]");
  console.log(`- Uses the User ID captured for this run and its generated email: ${testUserEmail}`);
  console.log("- Deletes only profiles linked to that captured User ID and that User record.");
  console.log("- Preserves all real accounts and MongoDB records.");

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
    // STEP 1 & 2: Register Synthetic User & Capture Cookie
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- STEP 1 & 2: Register Synthetic User & Capture Cookie ---");
    console.log(`Registering user: ${testUserEmail}`);
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test UI User",
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
    console.log("  [+] User registered successfully (HTTP 201) and session cookie captured.");
    passedTests++;

    // -------------------------------------------------------------------------
    // STEP 3: Create Synthetic MSME Profile via POST /api/profile
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- STEP 3: Create MSME Profile via POST /api/profile ---");
    console.log(`Submitting profile: legalName="${companyLegalName}"`);
    const createRes = await fetch(`${BASE_URL}/api/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify(syntheticProfile),
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
    // STEP 4 & 5: Request GET /tenders & Verify Listing Card for tnd-007
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- STEP 4 & 5: Request GET /tenders & Verify Listing Card ---");
    const listingRes = await fetch(`${BASE_URL}/tenders`, {
      method: "GET",
      headers: { Cookie: sessionCookie },
    });

    assert(listingRes.status === 200, "GET /tenders HTTP status must be 200", `got ${listingRes.status}`);
    const listingHtml = await listingRes.text();

    // 1. Verify Top Banner identifies personalized matching active for the company
    assert(
      listingHtml.includes("Personalized Tender Matching Active"),
      "Listing page must render 'Personalized Tender Matching Active' banner for signed-in MSME"
    );
    assert(
      listingHtml.includes(companyLegalName),
      `Listing page banner must mention company legalName: "${companyLegalName}"`
    );
    console.log(`  [+] Top banner confirms matching active for: "${companyLegalName}".`);

    // 2. Verify tnd-007 tender link and deep link exist
    assert(
      listingHtml.includes("/tenders/tnd-007"),
      "Listing page must contain link to /tenders/tnd-007"
    );
    assert(
      listingHtml.includes("/tenders/tnd-007#personalized-match"),
      "Listing card must contain deep link to #personalized-match"
    );
    assert(
      listingHtml.includes("View match details"),
      "Listing card must display 'View match details' link label"
    );

    // 3. Extract and verify personalized eligibility status for tnd-007
    const listingStatus = extractListingTnd007Status(listingHtml);
    assert(Boolean(listingStatus), "Could not extract eligibility status for tnd-007 card from listing HTML");
    console.log(`  [+] Extracted Listing Status for tnd-007: "${listingStatus}"`);
    assert(
      listingStatus === "Needs Verification",
      `Listing card eligibility status must be 'Needs Verification', got '${listingStatus}'`
    );
    passedTests++;

    // -------------------------------------------------------------------------
    // STEP 6 & 7: Request GET /tenders/tnd-007 & Verify Detail Page
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- STEP 6 & 7: Request GET /tenders/tnd-007 & Verify Detail Page ---");
    const detailRes = await fetch(`${BASE_URL}/tenders/tnd-007`, {
      method: "GET",
      headers: { Cookie: sessionCookie },
    });

    assert(detailRes.status === 200, "GET /tenders/tnd-007 HTTP status must be 200", `got ${detailRes.status}`);
    const detailHtml = await detailRes.text();

    // 1. Verify Personalized Tender Match section and anchor exist
    assert(
      detailHtml.includes("Personalized Tender Match"),
      "Detail page must render 'Personalized Tender Match' section"
    );
    assert(
      detailHtml.includes('id="personalized-match"'),
      "Detail page must contain id='personalized-match' container"
    );
    assert(
      detailHtml.includes("Update Profile"),
      "Detail page must render 'Update Profile' shortcut link for signed-in MSME"
    );
    assert(
      detailHtml.includes("Mandatory"),
      "Detail page criteria breakdown must label mandatory criteria"
    );

    // 2. Verify company legalName is identified in the detail section
    assert(
      detailHtml.includes(companyLegalName),
      `Detail page must display evaluated company legalName: "${companyLegalName}"`
    );
    console.log(`  [+] Detail page evaluates matching for: "${companyLegalName}".`);

    // 3. Extract and verify detail overall match status badge
    const detailStatus = extractDetailMatchStatus(detailHtml);
    assert(Boolean(detailStatus), "Could not extract match status badge from detail page HTML");
    console.log(`  [+] Extracted Detail Match Status: "${detailStatus}"`);
    assert(
      detailStatus === "Needs Verification",
      `Detail page match status must be 'Needs Verification', got '${detailStatus}'`
    );
    passedTests++;

    // -------------------------------------------------------------------------
    // STEP 8 & 9: Confirm Both Pages Match (Company Identity & Needs Verification)
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- STEP 8 & 9: Confirm Listing & Detail Consistency ---");
    console.log(`  - Listing Page Status : "${listingStatus}"`);
    console.log(`  - Detail Page Status  : "${detailStatus}"`);
    assert(
      listingStatus === detailStatus,
      "Listing card status and detail page status must be strictly identical",
      `listing="${listingStatus}", detail="${detailStatus}"`
    );
    assert(
      listingStatus === "Needs Verification",
      "Both pages must show 'Needs Verification' for incomplete self-declared profile"
    );
    console.log("  [+] Consistency Confirmed: Both pages identify the same company and display 'Needs Verification'.");
    passedTests++;

    // -------------------------------------------------------------------------
    // Architectural & Test Scope Limitations Report
    // -------------------------------------------------------------------------
    console.log("\n-----------------------------------------------------------------");
    console.log("   AUDIT & TESTING LIMITATIONS (Transparent Reporting)");
    console.log("-----------------------------------------------------------------");
    console.log("1. Verified via HTTP SSR Inspection:");
    console.log("   - HTTP response status codes 200 OK for authenticated requests.");
    console.log("   - Server-side rendered HTML contains correct DOM text and structure.");
    console.log("   - Company legalName rendered identically across catalogue & detail page.");
    console.log("   - Status badge text 'Needs Verification' extracted and matched across both pages.");
    console.log("2. Testing Limitations (What an HTTP HTML test cannot verify):");
    console.log("   - Client-side React hydration state or JavaScript event handlers.");
    console.log("   - Computed CSS layout, element positioning, and responsive breakpoints.");
    console.log("   - True browser visual rendering (e.g. font rendering, layout shifts, animations).");
    console.log("   - (These require a full browser automation environment like Playwright/Chromium).");

  } catch (err) {
    failedTests++;
    console.error(`\n[FAIL] Test suite failed: ${err.message}`);
  } finally {
    // -------------------------------------------------------------------------
    // STEP 10: Safe Database Cleanup
    // -------------------------------------------------------------------------
    console.log("\n=================================================================");
    console.log("   STEP 10: Safe Database Cleanup");
    console.log("=================================================================");

    try {
      await connectDB();
      console.log("[Cleanup] Connected to MongoDB.");

      // Strict ownership check
      if (!testUserEmail.startsWith("test-ui-user-")) {
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
