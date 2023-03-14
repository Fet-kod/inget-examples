import path from "node:path";
import assert from "node:assert";
import { readConfig } from "inget-helpers";
import { auth, sign, collect } from "../src/bankid.mjs";

function monotonicSeconds() {
  const nanos = process.hrtime.bigint();
  return Number(nanos / 1_000_000_000n);
}

async function collectUntilComplete({ apiClient, orderRef, logSubdir }) {
  const started = monotonicSeconds();
  const sleepSecondsBetweenAttempts = 2;

  let response;
  let attempt = 0;

  do {
    if (response) {
      await new Promise((resolve) =>
        setTimeout(resolve, sleepSecondsBetweenAttempts * 1000)
      );
    }

    const elapsedSeconds = monotonicSeconds() - started;
    if (elapsedSeconds > 60) {
      throw new Error(`collect timed out`);
    }

    response = await collect({
      apiClient,
      orderRef,
      onResponse: async (d) => {
        const attemptPadded = ("0000" + attempt).slice(-4);
        await this.responseLogger(
          path.join(logSubdir, `01-collect-${attemptPadded}.json`),
          d
        );
      },
    });

    attempt++;
  } while (response.status === "pending");

  return response;
}

export function itSupportsBankID() {
  const endUserIp = "127.0.0.1";

  before(async function () {
    const config = await readConfig(this.profile);
    if (!config.valid) {
      console.warn("config", config.errors);
      this.skip();
    }

    if (config.real) {
      console.debug(
        "this seems to be a real environment, open the BankID app to complete auth and sign flows"
      );
    }

    this.apiClient = config.apiClient;
    this.personalNumber = this.personalNumber || config.personalNumber;
    this.collectUntilComplete = collectUntilComplete.bind(this);
  });

  it("authenticates", async function () {
    const logSubdir = "authenticates";
    const { apiClient, responseLogger, personalNumber } = this;
    assert(apiClient, "missing apiClient");
    assert(responseLogger, "missing responseLogger");
    assert(personalNumber, "missing personalNumber");

    this.timeout(90000);

    const { orderRef } = await auth({
      apiClient,
      personalNumber,
      endUserIp,
      onResponse: async function (d) {
        await responseLogger(path.join(logSubdir, "00-request.json"), d);
      },
    });

    const { httpStatus, hintCode } = await this.collectUntilComplete({
      apiClient,
      orderRef,
      logSubdir,
    });

    if (httpStatus !== 200) {
      assert.fail(hintCode);
    }
  });

  it("signs", async function () {
    const logSubdir = "signs";
    const { apiClient, responseLogger, personalNumber } = this;
    assert(apiClient, "missing apiClient");
    assert(responseLogger, "missing responseLogger");
    assert(personalNumber, "missing personalNumber");

    this.timeout(90000);

    const { orderRef } = await sign({
      apiClient,
      personalNumber,
      endUserIp,
      text: "I promise to be nice.",
      onResponse: async function (d) {
        await responseLogger(path.join(logSubdir, "00-request.json"), d);
      },
    });

    const { httpStatus, hintCode } = await this.collectUntilComplete({
      apiClient,
      orderRef,
      logSubdir,
    });

    if (httpStatus !== 200) {
      assert.fail(hintCode);
    }
  });
}
