import { randomUUID } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import connectDB, { getMongoDatabaseName, resolveMongoUri } from "../lib/db.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const integrationModeKey = "TENDERBRIDGE_INTEGRATION_TEST";

function readTestMongoUriFromEnvFile() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    return "";
  }

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*TEST_MONGODB_URI\s*=(.*)$/);
    if (!match) {
      continue;
    }

    let value = match[1].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }

  return "";
}

function configureIntegrationTestDatabase() {
  if (!process.env.TEST_MONGODB_URI) {
    process.env.TEST_MONGODB_URI = readTestMongoUriFromEnvFile();
  }
  if (!process.env.TEST_MONGODB_URI) {
    throw new Error("Set TEST_MONGODB_URI before running an integration test.");
  }

  process.env[integrationModeKey] = "1";
  const databaseName = getMongoDatabaseName(resolveMongoUri());
  if (!databaseName) {
    throw new Error("TEST_MONGODB_URI must include an explicit database name.");
  }
  if (databaseName !== "tenderbridge_test") {
    throw new Error(
      'TEST_MONGODB_URI must use the exact database name "tenderbridge_test".'
    );
  }

  return process.env.TEST_MONGODB_URI;
}

async function findAvailablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  if (!address || typeof address === "string") {
    throw new Error("Could not allocate a local port for the integration-test server.");
  }
  return address.port;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function waitForServerExit(serverProcess, timeoutMilliseconds) {
  return new Promise((resolve) => {
    if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
      resolve(true);
      return;
    }

    const handleExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    const timeout = setTimeout(() => {
      serverProcess.off("exit", handleExit);
      resolve(false);
    }, timeoutMilliseconds);
    serverProcess.once("exit", handleExit);
  });
}

async function stopServerProcess(serverProcess) {
  if (
    !serverProcess ||
    !serverProcess.pid ||
    serverProcess.exitCode !== null ||
    serverProcess.signalCode !== null
  ) {
    return;
  }

  serverProcess.kill();
  if (await waitForServerExit(serverProcess, 5000)) {
    return;
  }

  serverProcess.kill("SIGKILL");
  if (!(await waitForServerExit(serverProcess, 5000))) {
    throw new Error("Could not stop the isolated Next.js integration-test server.");
  }
}

export function createIntegrationRunId() {
  return randomUUID();
}

export async function captureCreatedUserId(UserModel, email) {
  await connectDB();
  const user = await UserModel.findOne({ email }).select("_id").lean();
  if (!user) {
    throw new Error("The newly registered test user was not found in TEST_MONGODB_URI.");
  }
  return String(user._id);
}

export async function cleanupCreatedUser(UserModel, ProfileModel, userId, email) {
  if (!userId) {
    return { deletedProfiles: 0, deletedUser: 0 };
  }

  const user = await UserModel.findOne({ _id: userId, email }).select("_id").lean();
  if (!user) {
    return { deletedProfiles: 0, deletedUser: 0 };
  }

  const profiles = await ProfileModel.deleteMany({ userId: user._id });
  const deletedUser = await UserModel.deleteOne({ _id: user._id, email });
  return {
    deletedProfiles: profiles.deletedCount,
    deletedUser: deletedUser.deletedCount,
  };
}

export async function startIntegrationTestServer() {
  const testMongoUri = configureIntegrationTestDatabase();
  const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
  if (!fs.existsSync(nextCli)) {
    throw new Error("Next.js is not installed. Install project dependencies before running integration tests.");
  }

  const port = await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serverProcess = spawn(
    process.execPath,
    [nextCli, "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        NODE_ENV: "development",
        TEST_MONGODB_URI: testMongoUri,
        [integrationModeKey]: "1",
      },
      stdio: "ignore",
      windowsHide: true,
    }
  );

  let spawnError = false;
  serverProcess.on("error", () => {
    spawnError = true;
  });

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (spawnError || serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
      await stopServerProcess(serverProcess);
      throw new Error("The isolated Next.js integration-test server failed to start.");
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      let response;
      try {
        response = await fetch(`${baseUrl}/`, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      if (response.ok) {
        return {
          baseUrl,
          stop: () => stopServerProcess(serverProcess),
        };
      }
    } catch {
      // The server is not ready to accept requests yet.
    }
    await wait(500);
  }

  await stopServerProcess(serverProcess);
  throw new Error("Timed out while starting the isolated Next.js integration-test server.");
}
