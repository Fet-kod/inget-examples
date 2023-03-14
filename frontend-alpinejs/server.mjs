import { argv, exit } from "node:process";
import http from "node:http";
import fs from "node:fs";
import { bootstrap, readConfig, allProfiles } from "inget-helpers";
import { auth, sign, collect } from "bankid-node";
import { rejects } from "node:assert";

const port = parseInt(argv[2], 10);

const profiles = await allProfiles();
console.debug("profiles", await allProfiles());

const configByProfile = new Map();
for (let { profile, config } of profiles) {
  await bootstrap(profile);
  configByProfile[profile] = config;
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", (err) => rejects(err));
  });
}

const server = http.createServer(async (req, res) => {
  const baseUrl = new URL(`http://${req.headers.host}`);
  const url = new URL(req.url, baseUrl);
  const { pathname } = url;

  const flows = {
    "/auth": auth,
    "/sign": sign,
  };

  if (pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    fs.createReadStream("app.html").pipe(res);
  } else if (flows.hasOwnProperty(pathname)) {
    console.debug(pathname);

    const { personalNumber, text, profile, endUserIp } = JSON.parse(
      await readBody(req)
    );
    console.debug({
      personalNumber,
      text,
      profile,
    });
    const { apiClient, appUrl } = configByProfile[profile];

    const response = await flows[pathname]({
      apiClient,
      personalNumber,
      text,
      endUserIp,
    });

    let startUrl;
    if (response.httpStatus === 200) {
      startUrl = new URL(pathname, appUrl);
      startUrl.searchParams.set("autostarttoken", response.autoStartToken);
    }

    res.writeHead(response.httpStatus, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ...response, startUrl, appUrl }));
  } else if (pathname === "/profiles") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        profiles: profiles.map(
          ({ profile, config: { valid, errors, real, personalNumber } }) => ({
            profile,
            valid,
            errors,
            real,
            personalNumber,
          })
        ),
      })
    );
  } else if (pathname === "/collect") {
    console.debug(pathname);

    const { orderRef, profile } = JSON.parse(await readBody(req));
    const { apiClient } = configByProfile[profile];

    const response = await collect({
      apiClient,
      orderRef,
    });

    res.writeHead(response.httpStatus, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response));
  } else {
    console.warn("not found", pathname);
    res.writeHead(404);
    res.end();
  }
});

server.listen(port);
console.log(`visit http://localhost:${port}`);
