import { arch, platform } from "node:process";
import https from "node:https";
import path from "node:path";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import assert from "node:assert";
import child_process from "node:child_process";
import axios from "axios";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ingetHelpersRoot = path.resolve(__dirname, "..", "..", ".inget-data");
const configRoot = path.resolve(__dirname, "..", "..", "config");

export async function downloadInget() {
  const downloadOS = {
    linux: "linux",
    win32: "windows",
    darwin: "darwin",
  }[platform];
  if (!downloadOS) {
    throw new Error(`platform not supported: ${platform}`);
  }

  let downloadOSAndArch;
  let binaryName = "inget";
  let makeExecutable = true;
  if (downloadOS === "linux") {
    const downloadArch = {
      x64: "amd64",
    }[arch];
    if (!downloadArch) {
      throw new Error(`architeture not supported: ${arch}`);
    }
    downloadOSAndArch = `${downloadOS}-${downloadArch}`;
  } else if (downloadOS === "windows") {
    const downloadArch = {
      x64: "amd64",
    }[arch];
    if (!downloadArch) {
      throw new Error(`architeture not supported: ${arch}`);
    }
    downloadOSAndArch = `${downloadOS}-${downloadArch}`;
    binaryName = "inget.exe";
    makeExecutable = false;
  } else if (downloadOS === "darwin") {
    const downloadArch = {
      x64: "universal",
      arm64: "universal",
    }[arch];
    if (!downloadArch) {
      throw new Error(`architeture not supported: ${arch}`);
    }
    downloadOSAndArch = `${downloadOS}-${downloadArch}`;
  }
  if (!downloadOSAndArch) {
    throw new Error("could not determine operating system/architecturew");
  }

  const executablePath = path.resolve(ingetHelpersRoot, binaryName);
  if (await pathExists(executablePath)) {
    return executablePath;
  }

  console.debug(`downloading Inget to ${executablePath}...`);
  const url = `https://static.inget.app/releases/trial/${downloadOSAndArch}/${binaryName}`;
  const response = await axios({
    method: "GET",
    url,
    responseType: "stream",
  });
  response.data.pipe(fs.createWriteStream(executablePath));
  await new Promise((resolve, reject) => {
    response.data.on("end", resolve);
    response.data.on("error", reject);
  });
  console.debug("Inget downloaded.");

  if (makeExecutable) {
    await fsPromises.chmod(executablePath, 0o755);
  }

  return executablePath;
}

export async function startInget() {
  const executablePath = await downloadInget();

  const appUrl = "http://127.0.0.1:6080";
  const apiUrl = "https://127.0.0.1:6081";

  return new Promise((resolve, reject) => {
    const controller = new AbortController();

    const spawned = child_process.spawn(executablePath, [], {
      cwd: ingetHelpersRoot,
      signal: controller.signal,
    });
    spawned.stdout.setEncoding("utf8");
    spawned.stderr.setEncoding("utf8");
    let running = false;

    spawned.stderr.on("data", (data) => {
      if (data.includes("started")) {
        running = true;
        resolve({
          controller,
          appUrl,
          apiUrl,
        });
      }
    });

    spawned.on("error", (err) => {
      assert.equal(err.name, "AbortError");
    });

    spawned.on("close", (code) => {
      if (!running) {
        if (code !== 0) {
          reject(`not started, failed with code ${code}`);
        } else {
          assert.fail(
            "should never exit with code 0 when server never started"
          );
        }
      }
    });
  });
}

export async function allProfiles(path) {
  const profileNames = (
    await fsPromises.readdir(configRoot, { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const profiles = [];
  for (let profile of profileNames) {
    const skipped = await isSkipped(profile);
    const config = await readConfig(profile);
    profiles.push({ profile, skipped, config });
  }
  return profiles;
}

export async function isSkipped(profile) {
  const configDirectory = path.resolve(configRoot, profile);
  const skipPath = path.resolve(configDirectory, "skip");
  return pathExists(skipPath);
}

export async function bootstrap(profile) {
  const configDirectory = path.resolve(configRoot, profile);
  let didBootstrap = false;
  let inget = undefined; // set when local mode

  const bootstrapPath = path.resolve(configDirectory, "bootstrap.json");
  if (!(await pathExists(bootstrapPath))) {
    return {
      didBootstrap,
    };
  }

  let bootstrap = JSON.parse(
    await fsPromises.readFile(bootstrapPath, "utf8")
  );

  const bootstrapOverridePath = path.resolve(configDirectory, "bootstrap-override.json");
  if (await pathExists(bootstrapOverridePath)) {
    const bootstrapOverrides = JSON.parse(await fsPromises.readFile(bootstrapOverridePath, "utf8"));
    bootstrap = { ...bootstrap, ...bootstrapOverrides };
  }

  if (bootstrap.local) {
    inget = await startInget();
  }

  const resp = await axios({
    method: "GET",
    url: `${bootstrap.url}/_/manifest.json`,
  });
  assert.equal(resp.status, 200, "bootstrap failed");
  const manifest = resp.data;

  for (let { url, path: localPath } of manifest.config) {
    const resp = await axios({
      method: "GET",
      url,
      responseType: "stream",
    });
    assert.equal(resp.status, 200, `download failed: ${url}`);
    resp.data.pipe(fs.createWriteStream(path.join(configDirectory, localPath)));
    await new Promise((resolve, reject) => {
      resp.data.on("end", resolve);
      resp.data.on("error", reject);
    });
  }

  didBootstrap = true;
  return {
    didBootstrap,
    inget,
  };
}

export async function readConfig(profile) {
  let errors = [];
  const configDirectory = path.resolve(configRoot, profile);

  if (await isSkipped(profile)) {
    errors.push("manually disabled by presence of `skip` file");
    return { errors, valid: errors.length === 0 };
  }

  const configPath = path.resolve(configDirectory, "config.json");
  if (!(await pathExists(configPath))) {
    errors.push(`${configPath} not found`);
    return { errors, valid: errors.length === 0 };
  }

  const { apiUrl, appUrl, skipPersonal } = JSON.parse(
    await fsPromises.readFile(configPath)
  );

  if (!apiUrl) errors.push(`apiUrl not found in config`);
  if (!appUrl) errors.push(`appUrl not found in config`);
  if (errors.length) {
    return { errors, valid: errors.length === 0 };
  }

  let personalNumber = undefined;
  if (!skipPersonal) {
    const personalConfigBasename = "personal.json";
    const personalConfigPath = path.resolve(
      configDirectory,
      personalConfigBasename
    );

    if (!(await pathExists(personalConfigPath))) {
      errors.push(`${personalConfigPath} not found`);
      return { errors, valid: errors.length === 0 };
    }

    const personalConfig = JSON.parse(
      await fsPromises.readFile(personalConfigPath)
    );
    personalNumber = personalConfig.personalNumber;
    if (!personalNumber) {
      errors.push(`no personalNumber found in personal config`);
      return { errors, valid: errors.length === 0 };
    }
  }

  const certPath = path.resolve(configDirectory, "client-cert.pem");
  if (!(await pathExists(certPath))) errors.push(`${certPath} not found`);

  const keyPath = path.resolve(configDirectory, "client-key.pem");
  if (!(await pathExists(keyPath))) errors.push(`${keyPath} not found`);

  const caPath = path.resolve(configDirectory, "server.pem");
  if (!(await pathExists(caPath))) errors.push(`${caPath} not found`);

  if (errors.length) {
    return { errors, valid: errors.length === 0 };
  }

  const cert = await fsPromises.readFile(certPath);
  const key = await fsPromises.readFile(keyPath);
  const ca = await fsPromises.readFile(caPath);

  const httpsAgent = new https.Agent({ cert, key, ca });
  const apiClient = axios.create({
    baseURL: apiUrl,
    httpsAgent,
  });

  const real = appUrl.endsWith("bankid.com");
  return {
    apiClient,
    appUrl,
    personalNumber,
    real,
    errors,
    valid: errors.length === 0,
  };
}

async function pathExists(p) {
  try {
    await fsPromises.access(p);
  } catch (err) {
    if (err.code === "ENOENT") {
      return false;
    } else {
      throw err;
    }
  }
  return true;
}

