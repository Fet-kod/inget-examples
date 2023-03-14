import path from "node:path";
import { allProfiles } from "inget-helpers";
import { itSupportsBankID } from "./shared.mjs";
import { fileLogger } from "./testhelpers.mjs";

const profiles = await allProfiles();

describe("Real environments", function () {
  for (const { profile, skipped } of profiles) {
    if (!profile.startsWith("bankid-")) {
      console.debug(`${profile} is skipped because of name`)
      continue;
    }
    if (skipped) {
      console.debug(`${profile} is marked as skipped`);
      continue;
    }

    describe(profile, function () {
      before(async function () {
        this.profile = profile;
        this.responseLogger = await fileLogger(path.join(this.profile, "http"));
      });

      itSupportsBankID();
    });
  }
});
