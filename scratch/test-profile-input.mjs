import assert from "node:assert/strict";
import { describe, it } from "node:test";
import mongoose from "mongoose";
import MsmeProfile from "../models/MsmeProfile.js";
import { validateProfileInput } from "../lib/profile-input.js";

const requiredProfileFields = {
  legalName: "Example Company",
  msmeCategory: "Small",
  registeredAddress: "1 Example Street",
  city: "Example City",
  state: "Example State",
  pincode: "123456",
  contactPerson: "Example Contact",
  contactPhone: "1234567890",
  contactEmail: "contact@example.com",
};

function validateCapacity(value, isUpdate, includeField = true) {
  const body = isUpdate ? {} : { ...requiredProfileFields };
  if (includeField) {
    body.availableBidCapacity = value;
  }
  return validateProfileInput(body, isUpdate);
}

for (const isUpdate of [false, true]) {
  const operation = isUpdate ? "updates" : "creation";

  describe(`availableBidCapacity during profile ${operation}`, () => {
    it("rejects negative values", () => {
      for (const value of [-1, "-1"]) {
        const result = validateCapacity(value, isUpdate);
        assert.equal(result.ok, false);
        assert.equal(result.status, 400);
        assert.match(result.error, /non-negative/);
      }
    });

    it("accepts zero and positive numeric values", () => {
      for (const [value, expected] of [[0, 0], ["0", 0], [125.5, 125.5], ["250", 250]]) {
        const result = validateCapacity(value, isUpdate);
        assert.equal(result.ok, true);
        assert.equal(result.data.availableBidCapacity, expected);
      }
    });

    it("preserves optional behavior when the field is omitted", () => {
      const result = validateCapacity(undefined, isUpdate, false);
      assert.equal(result.ok, true);
      assert.equal(
        Object.prototype.hasOwnProperty.call(result.data, "availableBidCapacity"),
        false
      );
    });

    it("maps explicit empty values to null", () => {
      for (const value of [null, undefined, ""]) {
        const result = validateCapacity(value, isUpdate);
        assert.equal(result.ok, true);
        assert.equal(result.data.availableBidCapacity, null);
      }
    });

    it("rejects invalid and non-finite values", () => {
      for (const value of [
        NaN,
        Infinity,
        -Infinity,
        "NaN",
        "Infinity",
        "not-a-number",
        " ",
        true,
        {},
        [],
        Symbol("capacity"),
      ]) {
        const result = validateCapacity(value, isUpdate);
        assert.equal(result.ok, false, `Expected ${String(value)} to be rejected`);
        assert.equal(result.status, 400);
      }
    });
  });
}

describe("availableBidCapacity in the MSME profile schema", () => {
  function createProfile(capacity) {
    const profile = new MsmeProfile({
      userId: new mongoose.Types.ObjectId(),
      ...requiredProfileFields,
      availableBidCapacity: capacity,
    });
    return profile;
  }

  it("rejects negative values while allowing zero and positive values", async () => {
    const negativeProfile = createProfile(-1);
    await assert.rejects(negativeProfile.validate(), (error) => {
      assert.ok(error.errors.availableBidCapacity);
      return true;
    });
    await createProfile(0).validate();
    await createProfile(100).validate();
  });

  it("keeps the field optional and defaults it to null", async () => {
    const profile = createProfile(undefined);
    assert.equal(profile.availableBidCapacity, null);
    await profile.validate();
  });
});
