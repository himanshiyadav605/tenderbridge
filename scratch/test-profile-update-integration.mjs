/**
 * ============================================================================
 * TenderBridge - Profile Update & Verification Status Integration Test
 * ============================================================================
 *
 * This test suite validates updating an existing MSME company profile:
 *  1. Register one synthetic test user with a unique email.
 *  2. Capture the session cookie (tb_session).
 *  3. Create an initial MSME profile using POST /api/profile.
 *  4. Update its tradeName and businessDescription using PUT /api/profile.
 *  5. Verify the API response confirms the update (HTTP 200).
 *  6. Send a separate GET /api/profile request to inspect persistence.
 *  7. Confirm the updated values (tradeName, businessDescription) were persisted.
 *  8. Confirm unchanged fields (legalName, address, contact, udyam, etc.) remain intact.
 *  9. Confirm trusted verification statuses are preserved and not reset.
 * 10. Clean up only the synthetic user's profile and account in a finally block.
 *
 * Requirements:
 *  - Uses Node.js native fetch() and existing project dependencies.
 *  - Starts a local Next.js server connected to TEST_MONGODB_URI.
 *  - Safe cleanup verifying account ownership before deletion.
 *  - Sensitive values (passwords, session cookies) are never printed.
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

async function runTestSuite() {
  console.log("=================================================================");
  console.log("   TenderBridge Integration Test: Profile Update & Verification");
  console.log("=================================================================");

  const runId = createIntegrationRunId();
  const testUserEmail = `test-update-user-${runId}@example.com`;
  const defaultPassword = `UpdatePass#${runId}!`;

  let sessionCookie = null;
  let createdUserId = null;

  // Initial synthetic profile payload
  const initialProfile = {
    legalName: `Apex Structural Dynamics Pvt Ltd (Run ${runId})`,
    tradeName: "Apex Dynamics",
    udyamRegistrationNumber: `UDYAM-AR-${String(runId).slice(-7)}`,
    msmeCategory: "Small",
    constitutionType: "Private Limited",
    industry: "Artificers Works & Maintenance",
    businessDescription: "Specialized building repair and structural maintenance contracts.",
    registeredAddress: "Unit 402, High Altitude Industrial Park",
    city: "Tawang",
    state: "Arunachal Pradesh",
    pincode: "790104",
    contactPerson: "Sonam Dorjee",
    contactPhone: "+91 9436011223",
    contactEmail: testUserEmail,
    businessWebsite: "https://apexdynamics-test.local",
  };

  // Partial update payload (modifies tradeName and businessDescription)
  const updatedTradeName = "Apex Structural & Maintenance Services";
  const updatedBusinessDescription =
    "Upgraded multi-discipline civil, structural, and artificer maintenance contracts.";
  const updatePayload = {
    tradeName: updatedTradeName,
    businessDescription: updatedBusinessDescription,
  };

  console.log("\n[Planned Test Data]");
  console.log(`- Synthetic User Email: ${testUserEmail}`);
  console.log(`- Initial Legal Name   : ${initialProfile.legalName}`);
  console.log(`- Initial Trade Name   : ${initialProfile.tradeName}`);
  console.log(`- Updated Trade Name   : ${updatedTradeName}`);
  console.log(`- Updated Description  : ${updatedBusinessDescription}`);

  console.log("\n[Planned Cleanup Behavior]");
  console.log(`- Uses the User ID captured for this run and its generated email: ${testUserEmail}`);
  console.log("- Deletes only profiles linked to that captured User ID and that User record.");
  console.log("- Real user profiles and unrelated accounts remain untouched.");

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
    // STEP 1 & 2: Register User & Capture Session Cookie
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- STEP 1 & 2: Register Synthetic User & Capture Cookie ---");
    console.log(`Registering user: ${testUserEmail}`);
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Update User",
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
    console.log(`Submitting profile: legalName="${initialProfile.legalName}"`);
    const createRes = await fetch(`${BASE_URL}/api/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify(initialProfile),
    });

    const createBody = await createRes.json();
    assert(createRes.status === 201, "Profile creation HTTP status must be 201", `got ${createRes.status}`);
    assert(createBody.profile, "Response must include profile object");
    assert(
      String(createBody.profile.userId) === createdUserId,
      "Created profile must belong to the user registered by this run"
    );
    assert(
      createBody.profile.legalName === initialProfile.legalName,
      "Returned legalName must match initial payload"
    );
    assert(
      createBody.profile.tradeName === initialProfile.tradeName,
      "Returned tradeName must match initial payload"
    );
    assert(
      createBody.profile.profileVerificationStatus === "self_declared",
      "Initial verification status must be self_declared"
    );

    console.log(`  [+] Profile created with ID: ${createBody.profile._id}`);
    console.log(`  [+] Initial verification status: ${createBody.profile.profileVerificationStatus}`);

    // Simulate an established trusted workflow (e.g. administrative verification)
    // to establish a trusted verification status for testing Step 9
    console.log("\n[Setup Step 9] Simulating trusted administrative verification on this test profile...");
    await connectDB();
    await MsmeProfile.updateOne(
      { userId: createdUserId },
      {
        $set: {
          profileVerificationStatus: "verified",
          financialVerificationStatus: "verified",
          biddingCapacityVerificationStatus: "verified",
          lastVerifiedAt: new Date(),
        },
      }
    );
    console.log("  [+] Trusted verification statuses set in MongoDB for test user profile.");
    passedTests++;

    // -------------------------------------------------------------------------
    // STEP 4 & 5: Update tradeName and businessDescription via PUT /api/profile
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- STEP 4 & 5: Update Profile via PUT /api/profile ---");
    console.log("Sending partial update payload:", updatePayload);
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
      putBody.profile.tradeName === updatedTradeName,
      "PUT response tradeName must match updated value",
      `expected "${updatedTradeName}", got "${putBody.profile.tradeName}"`
    );
    assert(
      putBody.profile.businessDescription === updatedBusinessDescription,
      "PUT response businessDescription must match updated value",
      `expected "${updatedBusinessDescription}", got "${putBody.profile.businessDescription}"`
    );
    console.log("  [+] PUT /api/profile returned HTTP 200 confirming the update.");
    passedTests++;

    // -------------------------------------------------------------------------
    // STEP 6 & 7: Persistence Check via separate GET /api/profile
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- STEP 6 & 7: Verify Persistence via GET /api/profile ---");
    const getRes = await fetch(`${BASE_URL}/api/profile`, {
      method: "GET",
      headers: { Cookie: sessionCookie },
    });

    const getBody = await getRes.json();
    assert(getRes.status === 200, "GET /api/profile HTTP status must be 200", `got ${getRes.status}`);
    assert(getBody.profile !== null, "GET response must include profile object");

    // Verify updated values persisted
    assert(
      getBody.profile.tradeName === updatedTradeName,
      "Persisted tradeName must match updated value",
      `expected "${updatedTradeName}", got "${getBody.profile.tradeName}"`
    );
    assert(
      getBody.profile.businessDescription === updatedBusinessDescription,
      "Persisted businessDescription must match updated value",
      `expected "${updatedBusinessDescription}", got "${getBody.profile.businessDescription}"`
    );
    console.log("  [+] Persisted values confirmed: tradeName and businessDescription successfully updated.");
    passedTests++;

    // -------------------------------------------------------------------------
    // STEP 8: Confirm Unchanged Fields Remain Untouched
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- STEP 8: Confirm Unchanged Fields Remain Untouched ---");
    const persisted = getBody.profile;

    assert(
      persisted.legalName === initialProfile.legalName,
      "legalName must remain unchanged",
      `expected "${initialProfile.legalName}", got "${persisted.legalName}"`
    );
    assert(
      persisted.udyamRegistrationNumber === initialProfile.udyamRegistrationNumber,
      "udyamRegistrationNumber must remain unchanged",
      `expected "${initialProfile.udyamRegistrationNumber}", got "${persisted.udyamRegistrationNumber}"`
    );
    assert(
      persisted.msmeCategory === initialProfile.msmeCategory,
      "msmeCategory must remain unchanged",
      `expected "${initialProfile.msmeCategory}", got "${persisted.msmeCategory}"`
    );
    assert(
      persisted.constitutionType === initialProfile.constitutionType,
      "constitutionType must remain unchanged",
      `expected "${initialProfile.constitutionType}", got "${persisted.constitutionType}"`
    );
    assert(
      persisted.registeredAddress === initialProfile.registeredAddress,
      "registeredAddress must remain unchanged",
      `expected "${initialProfile.registeredAddress}", got "${persisted.registeredAddress}"`
    );
    assert(
      persisted.city === initialProfile.city,
      "city must remain unchanged",
      `expected "${initialProfile.city}", got "${persisted.city}"`
    );
    assert(
      persisted.state === initialProfile.state,
      "state must remain unchanged",
      `expected "${initialProfile.state}", got "${persisted.state}"`
    );
    assert(
      persisted.pincode === initialProfile.pincode,
      "pincode must remain unchanged",
      `expected "${initialProfile.pincode}", got "${persisted.pincode}"`
    );
    assert(
      persisted.contactPerson === initialProfile.contactPerson,
      "contactPerson must remain unchanged",
      `expected "${initialProfile.contactPerson}", got "${persisted.contactPerson}"`
    );
    assert(
      persisted.contactPhone === initialProfile.contactPhone,
      "contactPhone must remain unchanged",
      `expected "${initialProfile.contactPhone}", got "${persisted.contactPhone}"`
    );
    assert(
      persisted.contactEmail === initialProfile.contactEmail,
      "contactEmail must remain unchanged",
      `expected "${initialProfile.contactEmail}", got "${persisted.contactEmail}"`
    );
    assert(
      persisted.businessWebsite === initialProfile.businessWebsite,
      "businessWebsite must remain unchanged",
      `expected "${initialProfile.businessWebsite}", got "${persisted.businessWebsite}"`
    );
    console.log("  [+] All 12 unchanged fields verified identical to initial values.");
    passedTests++;

    // -------------------------------------------------------------------------
    // STEP 9: Confirm Trusted Verification Statuses Are Preserved
    // -------------------------------------------------------------------------
    totalTests++;
    console.log("\n--- STEP 9: Confirm Trusted Verification Statuses Are Preserved ---");
    assert(
      persisted.profileVerificationStatus === "verified",
      "profileVerificationStatus must remain 'verified' and not reset to self_declared",
      `expected 'verified', got '${persisted.profileVerificationStatus}'`
    );
    assert(
      persisted.financialVerificationStatus === "verified",
      "financialVerificationStatus must remain 'verified'",
      `expected 'verified', got '${persisted.financialVerificationStatus}'`
    );
    assert(
      persisted.biddingCapacityVerificationStatus === "verified",
      "biddingCapacityVerificationStatus must remain 'verified'",
      `expected 'verified', got '${persisted.biddingCapacityVerificationStatus}'`
    );
    console.log("  [+] Trusted verification statuses successfully preserved ('verified').");
    passedTests++;

  } catch (err) {
    failedTests++;
    console.error(`\n[FAIL] Test suite failed: ${err.message}`);
  } finally {
    // -------------------------------------------------------------------------
    // STEP 10: Clean up ONLY the synthetic user's profile and account
    // -------------------------------------------------------------------------
    console.log("\n=================================================================");
    console.log("   STEP 10: Safe Database Cleanup");
    console.log("=================================================================");

    try {
      await connectDB();
      console.log("[Cleanup] Connected to MongoDB.");

      // Strict ownership check: ensure email matches synthetic test pattern
      if (!testUserEmail.startsWith("test-update-user-")) {
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
