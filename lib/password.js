import { randomBytes, scrypt, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

function scryptHash(password, salt, keyLength) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, SCRYPT_OPTIONS, (error, derived) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derived);
    });
  });
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scryptHash(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password, storedHash) {
  if (typeof password !== "string" || typeof storedHash !== "string") {
    return false;
  }

  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt" || !parts[1] || !parts[2]) {
    return false;
  }

  let expected;
  try {
    expected = Buffer.from(parts[2], "base64url");
  } catch {
    return false;
  }

  if (expected.length === 0) {
    return false;
  }

  let derived;
  try {
    derived = await scryptHash(password, parts[1], expected.length);
  } catch {
    return false;
  }

  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}

let dummyHashPromise;

export async function verifyAgainstStoredOrDummy(password, storedHash) {
  if (typeof storedHash === "string" && storedHash.length > 0) {
    return verifyPassword(password, storedHash);
  }

  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword("timing-equalizer");
  }

  await verifyPassword(password, await dummyHashPromise);
  return false;
}
