
[![Version npm](https://img.shields.io/npm/v/@cap-ts/soap-adapter.svg)](https://www.npmjs.com/package/@cap-ts/soap-adapter)

# @cap-ts/soap-adapter

**SOAP Adapter for SAP CAP Applications (Node.js)**

## 📦 About

`@cap-ts/soap-adapter` is an API package for **SOAP Integration** based on [SAP CAP (SAP Cloud Application Programming Model)](https://cap.cloud.sap/docs/). It streamlines communication with SOAP services and natively supports integration — out of the box, with minimal configuration.
Refer to the [official documentation](https://github.com/cap-ts/soap-adapter/wiki) to get started.

## 🧰 Requirements & Setup

Additional documentation pages will be added soon.

## 🚀 Installation

The package is available on npm and can be installed as follows:

```bash
npm install @cap-ts/soap-adapter@latest
```

## 🛠️ Setup

1. Declare your target service with `kind: soap` and provide a WSDL path in your `package.json`:

```json
"requires": {
  "<ServiceName>": {
    "kind": "soap",
    "wsdl": "<wsdlpath/servicename>",
    "credentials": { "destination": "<destination_name>" },
  }
}
```

2. Tag your entities with `@soap.operation` and `@soap.rootResponse`, fields with `@soap.path` inside your `.cds` files.
3. Drop a custom script named `<ServiceName>.js` inside your project's `srv/lib/` folder extending `soap.ApplicationService` to intercept request lifecycles.

## 🛠️ Support & Feedback

We welcome your feedback, feature requests, and bug reports!

Submit an issue via our [GitHub Issues Tracker](https://github.com/cap-ts/soap-adapter/issues). Community feedback are appreciated and help shape the project’s evolution.

## 📄 License

This package is provided under the terms of the **SAP-Code-World** [Usage License Agreement](LICENSE).

© 2025 **SAP-Code-World**. All rights reserved.
