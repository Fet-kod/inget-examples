import path from "node:path";
import { bootstrap, allProfiles } from "inget-helpers";
import { itSupportsBankID } from "./shared.mjs";
import { fileLogger } from "./testhelpers.mjs";

const profiles = await allProfiles();

describe("Simulated environments", function () {

  for (const { profile, skipped } of profiles) {
    if (!profile.startsWith("inget-")) {
      console.debug(`${profile} is skipped because of name`)
      continue;
    }
    if (skipped) {
      console.debug(`${profile} is marked as skipped`);
      continue;
    }

    describe(profile, function () {
      let inget;

      before(async function () {
        this.profile = profile;
        this.responseLogger = await fileLogger(path.join(this.profile, "http"));

        // By appending "ic" to the personal number, the BankID flows will
        // complete immediately without user input.
        const immediateComplete = "ic";
        this.personalNumber =
          Math.random().toString(36).substring(7) + immediateComplete;

        const res = await bootstrap(this.profile);
        inget = res.inget;
      });

      itSupportsBankID();

      after(async function () {
        if (inget) {
          inget.controller.abort();
        }
      });
    });
  }
});
