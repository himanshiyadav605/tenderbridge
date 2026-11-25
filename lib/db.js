import mongoose from "mongoose";

const INTEGRATION_TEST_ENV = "TENDERBRIDGE_INTEGRATION_TEST";

export function getMongoDatabaseName(uri) {
  let parsedUri;
  try {
    parsedUri = new URL(uri);
  } catch {
    throw new Error("The MongoDB connection URI is invalid.");
  }

  if (parsedUri.protocol !== "mongodb:" && parsedUri.protocol !== "mongodb+srv:") {
    throw new Error("The MongoDB connection URI must use mongodb or mongodb+srv.");
  }

  try {
    const pathDatabaseName = decodeURIComponent(parsedUri.pathname.replace(/^\/+/, ""));
    const optionDatabaseName = parsedUri.searchParams.get("dbName") || "";
    if (pathDatabaseName.includes("/") || optionDatabaseName.includes("/")) {
      throw new Error("The MongoDB URI contains an invalid database name.");
    }
    if (
      pathDatabaseName &&
      optionDatabaseName &&
      pathDatabaseName.toLowerCase() !== optionDatabaseName.toLowerCase()
    ) {
      throw new Error("The MongoDB URI specifies conflicting database names.");
    }
    return optionDatabaseName || pathDatabaseName;
  } catch {
    throw new Error("The database name in the MongoDB connection URI is invalid or conflicting.");
  }
}

export function resolveMongoUri() {
  if (process.env[INTEGRATION_TEST_ENV] === "1") {
    const testUri = process.env.TEST_MONGODB_URI;
    if (!testUri) {
      throw new Error("TEST_MONGODB_URI is required in integration-test mode.");
    }

    const databaseName = getMongoDatabaseName(testUri);
    if (!databaseName) {
      throw new Error("TEST_MONGODB_URI must include an explicit database name.");
    }
    if (databaseName !== "tenderbridge_test") {
      throw new Error(
        'TEST_MONGODB_URI must use the exact database name "tenderbridge_test".'
      );
    }

    return testUri;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Please define the MONGODB_URI environment variable inside .env.local"
    );
  }

  return uri;
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Route usage in Next.js App Router.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  const uri = resolveMongoUri();

  if (cached.conn && mongoose.connection.readyState === 0) {
    cached.conn = null;
    cached.promise = null;
    cached.uri = null;
  }

  if (cached.conn) {
    if (
      process.env[INTEGRATION_TEST_ENV] === "1" &&
      (!cached.uri || cached.uri !== uri)
    ) {
      throw new Error("The cached MongoDB connection does not match the configured URI.");
    }
    if (!cached.uri) {
      cached.uri = uri;
    }
    return cached.conn;
  }

  if (!cached.promise) {
    cached.uri = uri;
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  } else if (
    process.env[INTEGRATION_TEST_ENV] === "1" &&
    cached.uri !== uri
  ) {
    throw new Error("A different MongoDB connection is already being established.");
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    cached.uri = null;
    throw error;
  }

  return cached.conn;
}

export default connectDB;
export { connectDB };
