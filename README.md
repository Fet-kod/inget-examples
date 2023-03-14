# inget-examples

Examples of using [Inget, a development environment and simulator for BankID](https://inget.app/). The code is compatible with many BankID environments, including

- the official test environment,
- the official production environment,
- the public hosted version of Inget, and
- the local version of Inget.

## Getting started

[See Inget docs](https://docs.inget.app/) for more information (in Swedish).

### Node

You need to have the latest LTS version of Node installed. If you
use the devcontainer, this is already done for you.

```bash
npm install
```

### Devcontainer

We recommend using the devcontainer. This will ensure that you have the same environment as we do.

While we develop and test in Linux the most, we run CI on Windows and macOS too. This includes running tests against the local version of Inget on all platforms.

## Projects

### [bankid-node](bankid-node/)

BankID integration in Javascript and Node, using the simulated Inget BankID environment as well as the official BankID environments.

### [frontend-alpinejs](frontend-alpinejs/)

A web app using [Alpine.js](https://alpinejs.dev/) that acts as a playground for the BankID integration.