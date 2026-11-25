/**
 * ============================================================================
 * TenderBridge - Profile API & Ownership Isolation Integration Test
 * ============================================================================
 *
 * This test suite validates the core user authentication and MSME profile
 * lifecycle using standard HTTP requests against a running TenderBridge server:
 *
 *  - Test 1: User Registration (Registers User A and User B, captures cookies)
 *  - Test 2: MSME Profile Creation (Creates profile for User A via POST /api/profile)
 *  - Test 3: Profile Persistence (Retrieves User A's profile via GET /api/profile)
 *  - Test 4: Ownership Isolation (Verifies User B cannot read or overwrite User A's profile)
 *  - Test 5: Original Data Integrity (Verifies User A's profile remains untouched)
 *
 * Requirements & Safety:
 *  - Uses Node.js native fetch() without external test frameworks.
 *  - Starts a local Next.js server connected to TEST_MONGODB_URI.
 *  - Uses run-unique email addresses to avoid data collisions.
 *  - Sensitive values (passwords, session cookies) are never logged.
 *  - Safe cleanup in a `finally` block removes only the test records created.
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

// Helper for consistent test assertions
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
  console.log("   TenderBridge Integration Test: MSME Profile & Isolation");
  console.log("=================================================================");

  // Random run identifier prevents collisions between concurrent runs.
  const runId = createIntegrationRunId();
  const userAEmail = `test-user-a-${runId}@example.com`;
  const userBEmail = `test-user-b-${runId}@example.com`;
  const defaultPassword = `TestPass#${runId}!`;

  let cookieUserA = null;
  let cookieUserB = null;

  // Track created user IDs for explicit, safe cleanup
  let createdUserAId = null;
  let createdUserBId = null;

  // Synthetic company profile payload for User A
  const syntheticProfileA = {
    legalName: `Apex Infra Solutions Pvt Ltd (Run ${runId})`,
    tradeName: "Apex Infra Solutions",
    udyamRegistrationNumber: `UDYAM-AR-${String(runId).slice(-7)}`,
    msmeCategory: "Small",
    constitutionType: "Private Limited",
    industry: "Artificers Works & Maintenance",
    businessDescription: "Civil engineering, road works, and specialized structural maintenance.",
    registeredAddress: "Plot 12-A, Industrial Estate, Phase 2",
    city: "Itanagar",
    state: "Arunachal Pradesh",
    pincode: "791111",
    contactPerson: "Rajesh Sharma",
    contactPhone: "+91 9436012345",
    contactEmail: userAEmail,
    businessWebsite: "https://apexinfra-test.local",
  };

  const integrationServer = await startIntegrationTestServer();
  const BASE_URL = integrationServer.baseUrl;
  console.log(`Target Server: ${BASE_URL}`);

  try {
    // -------------------------------------------------------------------------
    // Pre-flight Server Check
    // -------------------------------------------------------------------------
    console.log("\n[Pre-flight] Verifying server accessibility...");
    try {
      const probeRes = await fetch(`${BASE_URL}/`, { method: "GET" });
      console.log(`[Pre-flight] Server responded with status ${probeRes.status}.`);
    } catch (err) {
      throw new Error(`Cannot connect to server at ${BASE_URL}. Ensure Next.js is running. Details: ${err.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 1: Register Two Users
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- TEST 1: Register User A and User B ---");
    console.log(`Registering User A: ${userAEmail}`);
    const regResA = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User A",
        email: userAEmail,
        password: defaultPassword,
      }),
    });

    const regBodyA = await regResA.json();
    assert(regResA.status === 201, "User A registration status should be 201", `got ${regResA.status}`);
    assert(regBodyA.ok === true, "User A registration response should be { ok: true }");
    createdUserAId = await captureCreatedUserId(User, userAEmail);
    cookieUserA = extractSessionCookie(regResA);
    assert(Boolean(cookieUserA), "User A should receive a tb_session cookie");
    console.log("  [+] User A registered successfully (session cookie received).");

    console.log(`Registering User B: ${userBEmail}`);
    const regResB = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User B",
        email: userBEmail,
        password: defaultPassword,
      }),
    });

    const regBodyB = await regResB.json();
    assert(regResB.status === 201, "User B registration status should be 201", `got ${regResB.status}`);
    assert(regBodyB.ok === true, "User B registration response should be { ok: true }");
    createdUserBId = await captureCreatedUserId(User, userBEmail);
    cookieUserB = extractSessionCookie(regResB);
    assert(Boolean(cookieUserB), "User B should receive a tb_session cookie");
    console.log("  [+] User B registered successfully (session cookie received).");

    passedTests++;
    console.log("[PASS] Test 1: User Registration completed successfully.");

    // -------------------------------------------------------------------------
    // TEST 2: Create MSME Profile for User A
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- TEST 2: Create User A's Profile (POST /api/profile) ---");
    console.log(`Submitting profile with legalName: "${syntheticProfileA.legalName}"`);
    const createRes = await fetch(`${BASE_URL}/api/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieUserA,
      },
      body: JSON.stringify(syntheticProfileA),
    });

    const createBody = await createRes.json();
    assert(createRes.status === 201, "Profile creation should return 201", `got ${createRes.status} (${JSON.stringify(createBody)})`);
    assert(createBody.profile, "Response must include created profile object");
    assert(
      String(createBody.profile.userId) === createdUserAId,
      "Created profile must belong to User A registered by this run"
    );
    assert(
      createBody.profile.legalName === syntheticProfileA.legalName,
      "Returned legalName must match submitted legalName",
      `expected "${syntheticProfileA.legalName}", got "${createBody.profile.legalName}"`
    );
    assert(
      createBody.profile.profileVerificationStatus === "self_declared",
      "New profile must have verification status self_declared",
      `got ${createBody.profile.profileVerificationStatus}`
    );
    console.log(`  [+] Profile created with ID: ${createBody.profile._id}`);
    console.log(`  [+] Verification status: ${createBody.profile.profileVerificationStatus}`);

    passedTests++;
    console.log("[PASS] Test 2: MSME Profile Creation completed successfully.");

    // -------------------------------------------------------------------------
    // TEST 3: Verify Persistence for User A (GET /api/profile)
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- TEST 3: Verify Persistence (GET /api/profile for User A) ---");
    const getResA = await fetch(`${BASE_URL}/api/profile`, {
      method: "GET",
      headers: { Cookie: cookieUserA },
    });

    const getBodyA = await getResA.json();
    assert(getResA.status === 200, "Profile GET should return 200", `got ${getResA.status}`);
    assert(getBodyA.profile !== null, "Profile must not be null");
    assert(
      getBodyA.profile.legalName === syntheticProfileA.legalName,
      "Persisted legalName must match",
      `expected "${syntheticProfileA.legalName}", got "${getBodyA.profile.legalName}"`
    );
    assert(
      getBodyA.profile.udyamRegistrationNumber === syntheticProfileA.udyamRegistrationNumber,
      "Persisted udyamRegistrationNumber must match"
    );
    assert(
      getBodyA.profile.registeredAddress === syntheticProfileA.registeredAddress,
      "Persisted registeredAddress must match"
    );
    assert(
      getBodyA.profile.contactEmail === syntheticProfileA.contactEmail,
      "Persisted contactEmail must match"
    );
    assert(
      getBodyA.profile.msmeCategory === syntheticProfileA.msmeCategory,
      "Persisted msmeCategory must match"
    );
    console.log("  [+] Persisted profile fields correctly retrieved and validated.");

    passedTests++;
    console.log("[PASS] Test 3: Profile Persistence verified successfully.");

    // -------------------------------------------------------------------------
    // TEST 4: Verify Ownership Isolation
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- TEST 4: Verify Ownership Isolation ---");
    console.log("Part 4A: User B requests GET /api/profile (should receive { profile: null })");
    const getResB = await fetch(`${BASE_URL}/api/profile`, {
      method: "GET",
      headers: { Cookie: cookieUserB },
    });

    const getBodyB = await getResB.json();
    assert(getResB.status === 200, "User B GET /api/profile must return 200", `got ${getResB.status}`);
    assert(
      getBodyB.profile === null,
      "User B must not see User A's profile; expected { profile: null }",
      `got ${JSON.stringify(getBodyB.profile)}`
    );
    console.log("  [+] Confirmed: User B cannot view User A's profile (profile is null).");

    console.log("Part 4B: User B attempts PUT /api/profile to alter data");
    const maliciousPayload = {
      legalName: "Unauthorized Modification Attempt",
      tradeName: "Breach Attempt",
    };
    const putResB = await fetch(`${BASE_URL}/api/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieUserB,
      },
      body: JSON.stringify(maliciousPayload),
    });

    const putBodyB = await putResB.json();
    // In TenderBridge, PUT /api/profile for a user with no existing profile returns 404
    assert(
      putResB.status === 404,
      "User B's unauthorized update must be rejected with 404",
      `got ${putResB.status} (${JSON.stringify(putBodyB)})`
    );
    assert(
      typeof putBodyB.error === "string" && putBodyB.error.includes("not found"),
      "Response error should indicate profile was not found for User B"
    );
    console.log(`  [+] Confirmed: User B update rejected with status ${putResB.status} ("${putBodyB.error}").`);

    passedTests++;
    console.log("[PASS] Test 4: Ownership Isolation verified successfully.");

    // -------------------------------------------------------------------------
    // TEST 5: Verify User A's Profile Remains Untouched
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- TEST 5: Verify Original Data Remains Untouched ---");
    const verifyResA = await fetch(`${BASE_URL}/api/profile`, {
      method: "GET",
      headers: { Cookie: cookieUserA },
    });

    const verifyBodyA = await verifyResA.json();
    assert(verifyResA.status === 200, "User A GET /api/profile must return 200", `got ${verifyResA.status}`);
    assert(verifyBodyA.profile !== null, "User A profile must still exist");
    assert(
      verifyBodyA.profile.legalName === syntheticProfileA.legalName,
      "User A legalName must remain unaltered",
      `expected "${syntheticProfileA.legalName}", got "${verifyBodyA.profile?.legalName}"`
    );
    assert(
      verifyBodyA.profile.tradeName === syntheticProfileA.tradeName,
      "User A tradeName must remain unaltered",
      `expected "${syntheticProfileA.tradeName}", got "${verifyBodyA.profile?.tradeName}"`
    );
    console.log(`  [+] Confirmed: User A's profile name remains "${verifyBodyA.profile.legalName}".`);

    passedTests++;
    console.log("[PASS] Test 5: Original Data Integrity confirmed.");

  } catch (err) {
    failedTests++;
    console.error(`\n[FAIL] Test suite failed: ${err.message}`);
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Connect directly via Mongoose and delete ONLY test records
    // -------------------------------------------------------------------------
    console.log("\n=================================================================");
    console.log("   CLEANUP: Removing Synthetic Test Data from Database");
    console.log("=================================================================");

    try {
      await connectDB();
      console.log("[Cleanup] Connected to MongoDB.");

      const cleanupA = await cleanupCreatedUser(
        User,
        MsmeProfile,
        createdUserAId,
        userAEmail
      );
      console.log(`[Cleanup] User A: Deleted ${cleanupA.deletedProfiles} profile(s) and ${cleanupA.deletedUser} user record.`);

      const cleanupB = await cleanupCreatedUser(
        User,
        MsmeProfile,
        createdUserBId,
        userBEmail
      );
      console.log(`[Cleanup] User B: Deleted ${cleanupB.deletedProfiles} profile(s) and ${cleanupB.deletedUser} user record.`);

      console.log("[Cleanup] Completed safely without affecting existing user data.");
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
