# @cap-ts/soap-adapter

[![Version npm](https://img.shields.io/npm/v/@cap-ts/soap-adapter.svg)](https://www.npmjs.com/package/@cap-ts/soap-adapter)

> **CAP plugin that exposes legacy SOAP web services as read-only, OData-style entities of a `@sap/cds` service.**
> Node.js ≥ 20, `@sap/cds` ^9.9.1 or ^10 (cds 10 itself requires Node.js ≥ 22).

## 📦 About

`@cap-ts/soap-adapter` turns a WSDL operation into a CAP entity: consumers declare the entity in `.cds` with a small set of `@Soap.*` annotations, ship an adapter subclass that shapes the SOAP request/response, and the plugin does the rest — CSRF-safe HTTP routing (`/soap/**`), destination + JWT propagation, filter push-down, XML build/parse, response flattening, and an OData-style JSON response (`@odata.context`, `@odata.count`, `@odata.nextLink`). It is read only: writes are rejected with 405.

| Area | Features |
| --- | --- |
| Model | Seven typed CDS annotations (`@Soap`, `@Soap.operation`, `@Soap.binding`, `@Soap.rootResponse`, `@Soap.path`, `@Soap.filterRestriction`, `@Soap.adapter`), checked by `cds compile` |
| Adapter hooks | `header()` (SOAP headers), `request()` (input message, push-down sentinels), `response()` (raw rows), `mock()` (offline) |
| HTTP | `GET /soap/<path>/<Entity>` and `/<Entity>/<key>` with `$select`, `$filter`, `$orderby`, `$top`, `$skip` / `$skiptoken`, `$count`; OData-style JSON; `@requires` enforced |
| Queries | Fail-closed `$filter` parser, mandatory filter fields, one SOAP call per key value (`multipleSelection: false`), push-down or bounded in-memory evaluation with `@odata.nextLink` |
| In process | The SOAP service is a CAP service: other services read it with `srv.run(SELECT ...)` or `soap.read(...)` (e.g. `@cap-ts/remote-service-adapter`) |
| Connectivity | BTP destinations per request and tenant, JWT-based lookup, client cache per service / destination / endpoint / tenant |
| Security | Inbound credentials never forwarded, forbidden SOAP header keys stripped, redacted logs, WSDL path sandbox, generic 5xx messages |

---

## 📑 Table of Contents

📥 [Installation](#-installation)\
📖 [Usage Guidelines](#-usage-guidelines)\
⚡ [Quick start (5 minutes)](#-quick-start-5-minutes)\
📝 [CDS annotation reference (`@Soap.*`)](#-cds-annotation-reference-soap)\
🌐 [HTTP endpoints and query options](#-http-endpoints-and-query-options)\
🔗 [Using SOAP entities from other services](#-using-soap-entities-from-other-services)\
🔌 [Adapter class API (`soap.ApplicationService`)](#-adapter-class-api-soapapplicationservice)\
🧰 [Utility API (`soap.*`)](#-utility-api-soap)\
⚙️ [Configuration (`cds.env.soap.*`)](#️-configuration-cdsenvsoap)\
🏢 [Multi-tenant destinations & JWT propagation](#-multi-tenant-destinations--jwt-propagation)\
🔍 [Filter push-down & `filterRestriction`](#-filter-push-down--filterrestriction)\
🔒 [Security guarantees](#-security-guarantees)\
🚦 [Errors and results](#-errors-and-results)\
🛠️ [Troubleshooting](#️-troubleshooting)\
💬 [Support & feedback](#-support--feedback)\
📄 [License](#-license)

---

## 📥 Installation

[↑ Table of Contents](#-table-of-contents)

The package is available on npm and can be installed as follows:

```bash
npm install @cap-ts/soap-adapter
```

The package registers itself as a CAP plugin via `cds-plugin` — no explicit `require()` is needed. `cds watch` and `cds build` pick it up automatically.

### Peer requirements

| Peer | Version | Notes |
| --- | --- | --- |
| `@sap/cds` | `^9.9.1 \|\| ^10` | Tested against 9.9.3 and 10.1.1. |
| Node.js | >=20 | cds 10 itself requires Node 22 or later. |
| `@cap-js/cds-types` | >=0.18.0, optional | TypeScript types only; not needed to run the adapter. |
| `@sap-cloud-sdk/http-client` | ^4.7.0 | Destination-based HTTP calls. |
| `@sap-cloud-sdk/connectivity` | ^4.7.0 | Destination resolution and JWT forwarding. |
| `soap` | ^1.10.0 | Dependency, installed automatically. |
| `p-limit` | ^3.1.0 | Dependency, installed automatically. |

Optional but recommended:

| Dep | When | Notes |
| --- | --- | --- |
| `ts-node` | You author adapter classes in TypeScript and nothing else loads `.ts` | Not needed with `cds watch` / `cds-tsx`, `tsx`, or Node 22.18 and later (built-in type stripping). Otherwise the loader registers `ts-node/transpile-only` on demand. A missing `ts-node` is only a `debug` line; if the adapter then fails to load, the error says how to fix it. |

---

## 📖 Usage Guidelines

[↑ Table of Contents](#-table-of-contents)

```diagram
┌────────────────────────────────────────────────────────────────────────┐
│  Consumer BP.cds                                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ using from '@cap-ts/soap-adapter';                               │  │
│  │ service BP {                                                     │  │
│  │   @Soap.operation: 'GetBusinessPartner'                          │  │
│  │   @Soap.binding: {                                               │  │
|  |     rootRequest: 'GetBusinessPartnerRequest',                    │  │
│  │     rootResponse: 'GetBusinessPartnerResponse'                   │  │
|  |   }                                                              │  │
│  │   entity BusinessPartner {                                       |  |
|  |     key BusinessPartnerID : String;                              |  |
|  |     ...                                                          |  |
|  |   };                                                             │  │
│  │ }                                                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                         │
│                              ▼                                         │
│  Consumer srv/lib/BP.js  (extends soap.ApplicationService)             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ init() {                                                         │  │
│  │   this.header(BusinessPartner, req => ({ Authorization: … }));   │  │
│  │   this.request(BusinessPartner, (req, payload) => …);            │  │
│  │   this.response(BusinessPartner, (req, rows) => rows.map(…));    │  │
│  │ }                                                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼   at boot: `cds.on('served')`
┌────────────────────────────────────────────────────────────────────────┐
│  @cap-ts/soap-adapter runtime                                          │
└────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        OData-style GET endpoint at `/soap/<service path>/<Entity>`
```

Two-word summary: **annotate + subclass**. The plugin needs both — the annotations tell it *what* to route, the subclass tells it *how* to marshal.

---

## ⚡ Quick start (5 minutes)

[↑ Table of Contents](#-table-of-contents)

Assume a CAP project laid out like:

```diagram
srv/
  external/
    BP.cds              ← SOAP service model
    lib/
      BP.js             ← adapter subclass (of soap.ApplicationService)
    wsdl/
      BP.wsdl           ← WSDL cached locally
package.json
```

**1. Configure the SOAP service in `package.json`.**

```json
{
  "cds": {
    "requires": {
      "BP": {
        "kind": "soap",
        "wsdl": "srv/external/wsdl/BP.wsdl",
        "credentials": { "destination": "DEST_BP" }
      }
    }
  }
}
```

- `kind: "soap"` is the marker that tells the loader "this service's entities are SOAP-backed".
- `wsdl` — relative path from `cds.root`. Loaded once per service, cached per destination.
- `credentials.destination` — SAP BTP destination name; JWT + basic-auth resolution goes through `@sap-cloud-sdk/connectivity`.

**2. Declare the entity in `srv/external/BP.cds`.**

```cds
using from '@cap-ts/soap-adapter';

@Soap
service BP {
    @Soap.operation  : 'GetBusinessPartner'
    @Soap.binding    : {
        rootRequest  : 'GetBusinessPartnerRequest',
        rootResponse : 'GetBusinessPartnerResponse'
    }
    entity BusinessPartner {
            @Soap.path        : '<path of BusinessPartnerID from response body>'
        key BusinessPartnerID : String;
            @Soap.path        : '<path of FullName from response body>'
            FullName          : String;
            @Soap.path        : '<path of CountryCode from response body>'
            CountryCode       : String;
    }
}
```

**3. Ship an adapter subclass at `srv/external/lib/BP.js`.**

```js
const { soap } = require('@cap-ts/soap-adapter');

class BP extends soap.ApplicationService {
    init() {
        const { BusinessPartner } = this.entities;

        this.request(BusinessPartner, (req, payload) => {
            // Shape the SOAP body (the operation's input message) from the incoming CAP $filter.
            const key = req.query?.SELECT?.where; // CQN WHERE array
            return { BusinessPartnerID: extractBpId(key) };
        });

        this.response(BusinessPartner, (req, rows) => {
            // Rows are the raw entries under `rootResponse`; `@Soap.path` mapping runs after this hook.
            return rows.filter(r => r != null);
        });
    }
}
module.exports = BP;
```

**4. Start `cds watch`.** The loader mounts GET routes under `/soap` + the service's `@path`, or, without `@path`,
its short name in lower case:

- `/soap/bp/BusinessPartner` — the entity set (`$select`, `$count`, `$filter`, `$orderby`, `$top`, `$skip`; any other
  system query option is a 400). `@requires` on the service is enforced.
- `/soap/bp/BusinessPartner/<key>` — a read by key (404 when nothing comes back).

Details: [HTTP endpoints and query options](#-http-endpoints-and-query-options).

---

## 📝 CDS annotation reference (`@Soap.*`)

[↑ Table of Contents](#-table-of-contents)

| Annotation | On | Required | Purpose |
| --- | --- | --- | --- |
| `@Soap` | service | No | Marks the service in the model (documentation; `kind: 'soap'` in `cds.requires` is what activates it). |
| `@Soap.operation: '<Operation>'` | entity | **Yes** | WSDL operation that serves reads. Entities without it are ignored. |
| `@Soap.binding: { rootRequest, rootResponse }` | entity | No | `rootResponse`: dot path of the response element holding the rows. `rootRequest`: documentation only. |
| `@Soap.rootResponse: '<path>'` | entity | No | Same as `binding.rootResponse`, takes precedence. Default `<operation>Response`. |
| `@Soap.path: '<dot.path>'` | element | No | Where the element's value sits in one response entry. Default: the element name. |
| `@Soap.filterRestriction: { mandatoryFields, multipleSelection }` | entity | No | Fields `$filter` must contain (400 otherwise); `multipleSelection: false` = one SOAP call per key value. |
| `@Soap.adapter: '<npm specifier>'` | entity / service | No | Adapter module, instead of the `lib/<Service>.{ts,js}` convention. |

All seven annotations (`@Soap` and the six `@Soap.*` below) are declared in the package's `index.cds` under the single canonical top-level namespace. `@Soap` (Boolean) only marks a service in the model; what makes a service SOAP-backed at runtime is `kind: "soap"` in `cds.requires`. They are real CDS typed annotations, so `cds compile` type-checks consumer usage — typos and shape mismatches surface at build time, not at first request.

### `@Soap.binding` *(struct, entity-level)*

Binds an entity to a concrete SOAP request/response element pair.

```cds
@Soap.binding: {
    rootRequest  : 'GetBusinessPartnerRequest',   // outbound wrapper element
    rootResponse : 'GetBusinessPartnerResponse'   // inbound element to unwrap
}
entity BusinessPartner { … }
```

| Field | Required | Notes |
| ----- | -------- | ----- |
| `rootRequest` | No | Documents the operation's input element. The runtime does not wrap the payload with it: `node-soap` builds the request envelope from the WSDL operation, and the `request()` hook's return value is passed to it as the input message. |
| `rootResponse` | No | Dot path of the SOAP response element whose contents become the CAP result. If `@Soap.rootResponse` (scalar) is set it takes precedence; without either, `<operation>Response` is used. |

### `@Soap.operation` *(scalar, entity-level)* — **required**

WSDL operation name serviced for SELECT / READ requests on this entity.

```cds
@Soap.operation: 'GetBusinessPartner'
entity BusinessPartner { … }
```

An entity without an `@Soap.operation` is invisible to the loader — no route is mounted, no CAP handler registered. This is the load-time gate.

### `@Soap.rootResponse` *(scalar, entity-level)* — optional

Dot path of the SOAP response element to unwrap. When set, it takes precedence over `@Soap.binding.rootResponse`.

### `@Soap.path` *(scalar, element-level)*

Dot path, relative to one entry under `rootResponse`, from which the value of this element is read.

```cds
entity BusinessPartner {
    key BusinessPartnerID : String;
        @Soap.path : 'data.Address.CountryCode'
        CountryCode : String;
}
```

Without `@Soap.path`, the element's own name is used as the path (case-sensitive). `$value` wrappers and `item` / `Item` arrays are unwrapped along the way; a missing value becomes `null`. Only elements with a built-in `cds.*` type are mapped. `@Soap.path` is essential when SOAP responses nest values several levels deep or when element names differ from the response.

### `@Soap.filterRestriction` *(struct, entity-level)*

Per-entity filter policy enforced by the runtime **before** dispatch.

```cds
@Soap.filterRestriction: {
    mandatoryFields   : [ 'BusinessPartnerID' ],
    multipleSelection : false
}
entity BusinessPartner { … }
```

| Field | Type | Behaviour |
| ----- | ---- | --------- |
| `mandatoryFields` | `array of String` | Property names that MUST appear in `$filter` for the request to be accepted. Missing fields raise a 400 with a diagnostic message that names the field. |
| `multipleSelection` | `Boolean` (default: not set) | Set it to `false` when the SOAP operation accepts only one key value per call. The runtime then expands a `$filter` with `<first key> in (a,b,c)` into one SOAP call per value (in batches of `cds.env.soap.multiSelectionConcurrency`, default 5) and merges the results. A second `in(…)` on the key, or `in(…)` combined with `or`, is a 400 (`UNSUPPORTED_MULTI_SELECTION_FILTER`). When `true` or not set, nothing is expanded and the `request()` hook receives the `in(…)` as is. |

See § [Filter push-down & `filterRestriction`](#-filter-push-down--filterrestriction) below.

### `@Soap.adapter` *(scalar, entity- or service-level)* — optional

npm specifier of the adapter module implementing the request / response / mock / header hooks. Resolved at boot.

```cds
@Soap.adapter : '@my-org/bp-adapter'   // sibling package
service BP { … }

// or, per-entity override:
@Soap.adapter : '@my-org/bp-adapter/dist/BusinessPartner'
entity BusinessPartner { … }
```

#### Resolution order

1. Entity-level `@Soap.adapter` (if set).
2. Service-level `@Soap.adapter` (if set).
3. Filesystem convention: `<dir-of-the-.cds-file>/lib/<ServiceShortName>.{ts,js}`.

On specifier resolution failure the loader logs a diagnostic (`adapter specifier X declared on Y could not be resolved from Z: … — falling back to filesystem convention`) and continues with the filesystem probe. This means: an unresolvable specifier never crashes boot, but you get a loud line to grep for.

Use `@Soap.adapter` when:

- The adapter class is shipped from a sibling package in a monorepo.
- The `.cds` is pre-compiled and `$location.file` is unavailable.
- You want to compose adapters across packages, or override the convention per entity.

---

## 🔌 Adapter class API (`soap.ApplicationService`)

[↑ Table of Contents](#-table-of-contents)

Every SOAP-backed service ships an adapter class that extends `soap.ApplicationService`. The class is instantiated once per service at boot and its `init()` method is called to register per-entity hooks.

```js
const { soap } = require('@cap-ts/soap-adapter');

class BP extends soap.ApplicationService {
    init() {
        const { BusinessPartner } = this.entities;
        // register hooks …
    }
}
module.exports = BP;
```

### Constructor properties

Available inside `init()` via `this.*`:

| Property | Type | Description |
| -------- | ---- | ----------- |
| `this.entities` | `Record<string, Csn.Entity>` | CSN entity definitions for the service, keyed by entity short name. |
| `this.model` | `Csn.Model` | Full CSN model for the service. |
| `this.options` | `object` | Merged `cds.requires.<ServiceName>` config object (wsdl path, credentials, …). |

### `this.header(entity, fn)` — outbound HTTP headers

Registers a hook (or a static object) that adds a **SOAP header** — an element inside the envelope's `<soap:Header>` — to every outbound call for `entity`. It is passed to `node-soap`'s `addSoapHeader`; it does not set HTTP headers.

```js
// Plain map: each key becomes a header element.
this.header(BusinessPartner, (req) => ({ TraceID: req.id }));

// Structured: value plus element name, namespace prefix and URI.
this.header(BusinessPartner, () => ({
    value: { Username: 'user', Password: 'secret' },
    name: 'UsernameToken', prefix: 'wsse',
    xmlns: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd'
}));
```

- Hook arguments: `(req, payload)` — the CAP `Request` and the outbound payload.
- Return value: a plain map, or a structured `{ value, name?, prefix?, xmlns? }`. Returning `null` / `undefined` adds nothing.
- In a plain map, keys on the forbidden list below are dropped (with a warning), so inbound credentials cannot be copied into the envelope by accident.
- Without any `header()` hook the runtime adds one default SOAP header, `TraceID`, with the request's correlation id.
- Called once per SOAP dispatch (including each fan-out call for `multipleSelection: false`).

### `this.request(entity, fn)` — outbound SOAP payload

Registers a hook that shapes the SOAP request body for `entity`.

```js
this.request(BusinessPartner, (req, payload) => {
    // payload is the runtime-built object before XML serialisation.
    // Augment or replace it entirely.
    return { ...payload, Language: req.locale ?? 'EN' };
});
```

- `req` — incoming CAP `Request`; read `$filter` / keys from `req.query.SELECT.where`.
- `payload` — `req.data` (usually `{}` for a READ) for the first hook, else the previous hook's return value.
- Return value: the operation's input message, passed to `node-soap`, which builds the `<soap:Body>` from the WSDL.
- Several `request()` hooks run in registration order, each receiving the previous result. Always return the payload:
  a hook that returns `undefined` sends an empty request.

### `__filterPushedDown` sentinel

To signal that your `request()` hook has already embedded `$filter` / `$orderby` / `$top` / `$skip` into the outbound SOAP payload, return an object with `__filterPushedDown: true` from the hook. The runtime reads and **strips** the sentinel before the SOAP call, then skips the in-memory `$filter` / `$orderby` / `$top` / `$skip` evaluator — only `$select` projection and `$count` still run.

This is the single-hook pattern: one `request()` call does both payload building and push-down signalling.

```ts
async init() {
    this.request(BusinessPartner, async (req) => {
        const payload = this._buildSelection(req.query);
        (payload as any).__filterPushedDown = true;  // signal: skip in-memory eval
        return payload;
    });
}
```

- **Sentinel is stripped before SOAP dispatch.** The `__filterPushedDown` key is never forwarded to the backend; the runtime deletes it from a shallow clone of the payload.
- **Last writer wins.** If multiple `request()` handlers are registered for the same entity, the sentinel is read from the final merged payload after all handlers have run.
- **Feature-flagged.** Set `cds.env.soap.pushFilters: false` to force the in-memory path even when the sentinel is present.
- **No separate hook needed.** There is no `translateFilter` method to override — the `request()` hook is the single integration point for both payload building and push-down signalling.

### `__skipPagination` sentinel

Return `__skipPagination: true` on the `request()` payload (stripped before dispatch like `__filterPushedDown`) when
the in-memory evaluation must not cut the result to one page: `$filter` / `$orderby` still run in memory, but no page
cap and no `@odata.nextLink` apply. Callers inside the application can ask for the same with
`SELECT.__skipPagination = true` on the query (used by `@cap-ts/remote-service-adapter` for association reads that
need every row).

**When push-down is not set** (sentinel absent or `pushFilters: false`), the runtime falls back to the bounded in-memory evaluator (`cds.env.soap.pageSize`, default `1000`, capped at `5000`) and emits an `@odata.nextLink` header when the result exceeds one page.

### `this.mock(entity, fn)` — offline / test mock

Registers a mock handler that **replaces** the actual SOAP call. Useful for unit tests and offline development.

```js
this.mock(BusinessPartner, (req) => {
    return [{ BusinessPartnerID: 'BP001', FullName: 'ACME Corp' }];
});
```

- Return value: the final rows, in the shape of the CAP entity. The mock's result is returned as is: no `response()` hooks, no `@Soap.path` mapping and no in-memory `$filter` / `$orderby` / paging.
- When a mock is registered the runtime skips destination resolution, WSDL loading, and HTTP dispatch entirely.
- A registered mock is always active, in every environment — register it only in test or development code.

### `this.response(entity, fn)` — inbound result transform

Registers a hook that post-processes the SOAP result before it is mapped to the entity.

```js
this.response(BusinessPartner, (req, rows) => {
    return rows
        .filter(r => r.Active === 'X')
        .map(r => ({ ...r, FullName: r.FullName?.trim() ?? '' }));
});
```

- `req` — the incoming CAP `Request`.
- `rows` — the raw entries under `rootResponse` (always an array). `@Soap.path` mapping and the in-memory
  `$filter` / `$orderby` / paging run **after** this hook, so return entries in the raw response shape.
- Several `response()` hooks run in registration order, each receiving the previous result. Always return an array:
  a hook that returns `undefined` yields an empty result.

### `soap.ApplicationService.stripSensitiveHeaders(headers)` — static helper

Returns a copy of a header map without the entries that must never reach a backend (auth tokens, session cookies, SAP passport, trace/correlation identifiers). Use it when a `header()` hook builds SOAP headers from a map it did not write itself, such as the inbound request headers:

```js
this.header(BusinessPartner, (req) => ({
    // Everything from the inbound request except credentials, cookies and trace ids.
    ...soap.ApplicationService.stripSensitiveHeaders(req.http?.req?.headers ?? {}),
    TraceID: req.id
}));
```

Removed header names (case-insensitive):

| Header | Category |
| ------ | -------- |
| `authorization` | Auth |
| `proxy-authorization` | Auth |
| `cookie` | Session |
| `set-cookie` | Session |
| `x-forwarded-for` | Forwarded identity |
| `x-forwarded-host` | Forwarded identity |
| `x-forwarded-proto` | Forwarded identity |
| `x-forwarded-authorization` | Forwarded identity |
| `x-real-ip` | Forwarded identity |
| `x-request-id` | Trace |
| `x-correlation-id` | Trace |
| `x-vcap-request-id` | Trace (CF) |
| `x-cf-app-instance` | Trace (CF) |
| `x-b3-traceid` | Trace (B3) |
| `x-b3-spanid` | Trace (B3) |
| `x-b3-parentspanid` | Trace (B3) |
| `x-b3-sampled` | Trace (B3) |
| `traceparent` | Trace (W3C) |
| `tracestate` | Trace (W3C) |
| `sap-passport` | SAP |
| `saml-token` | SAP |
| `x-csrf-token` | SAP |
| `sec-websocket-key` | WebSocket |
| `sec-websocket-accept` | WebSocket |

The full list is exposed as the frozen constant `soap.ApplicationService.FORBIDDEN_SOAP_HEADERS` (a `readonly string[]`). Consumers can inspect or extend it:

```js
const { soap } = require('@cap-ts/soap-adapter');

// Inspect the built-in list
console.log(soap.ApplicationService.FORBIDDEN_SOAP_HEADERS);

// Extend with your own headers (create a new Set — do not mutate the frozen array)
const myForbidden = new Set([
    ...soap.ApplicationService.FORBIDDEN_SOAP_HEADERS,
    'x-my-internal-token',
]);
const withoutForbidden = (headers) =>
    Object.fromEntries(Object.entries(headers).filter(([k]) => !myForbidden.has(k.toLowerCase())));

this.header(BusinessPartner, (req) => withoutForbidden(req.http?.req?.headers ?? {}));
```

---

## 🧰 Utility API (`soap.*`)

[↑ Table of Contents](#-table-of-contents)

Beyond `ApplicationService`, the package exports a set of standalone utilities available directly on the `soap` namespace. These cover the low-level primitives the orchestrator uses internally — consumers can call them directly when building advanced adapters, testing utilities, or routing logic.

```js
const { soap } = require('@cap-ts/soap-adapter');
// soap.createRequest(...)
// soap.read(...)
// soap.getEntityKeyFields(...)
// soap.dedupByKeys(...)
// soap.isSoapService(...)
```

### `soap.createRequest(opts)` — build a typed `cds.Request` for SOAP dispatch

Creates a real `cds.Request` instance suitable for SOAP dispatch. Every request gets a fresh `context.id` (`'soap-' + UUID`).

```js
const req = soap.createRequest({
    event:   'READ',
    query:   SELECT.from('BusinessPartner').where({ BusinessPartnerID: 'BP001' }),
    target:  srv.entities.BusinessPartner,
    user:    inboundReq.user,
    http:    inboundReq.http,
    headers: inboundReq.headers,
});
```

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `event` | `string` | Yes | CAP event name, e.g. `'READ'`. |
| `query` | `object` | Yes | CQN query object. |
| `data` | `object` | No | Request data / query parameters. |
| `headers` | `object` | No | HTTP headers (shallow-cloned to avoid mutating the caller's object). |
| `target` | `object` | No | CDS entity definition (`req.target`). |
| `params` | `any[]` | No | By-key params array (`req.params`). |
| `user` | `object` | No | `cds.User` instance (`req.user`). |
| `http` | `{req,res}` | No | Express req/res pair. |

Returns a `cds.Request` instance.

### `soap.read(srv, entity, req, query, opts?)` — one-shot SOAP read

One-shot SOAP read: assemble headers, build a real `cds.Request`, dispatch, and deduplicate the result by entity key fields.

```js
const rows = await soap.read(
    srv,               // ApplicationService instance
    'BusinessPartner', // entity short name (key into srv.entities)
    req,               // inbound CAP request (source of user, params, headers)
    req.query,         // CQN SELECT query
    {                  // optional overrides
      headers: ...,
      params: ...,
      outerReq: req,
      fallbackEntityDef: ...
    }
);
```

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `srv` | `ApplicationService` | Yes | The SOAP adapter instance. |
| `entity` | `string` | Yes | Unqualified entity short name, e.g. `'BusinessPartner'`. |
| `req` | `cds.Request` | Yes | Source of `user`, `params`, and `headers`. |
| `query` | `object` | Yes | CQN SELECT query passed to `createRequest`. |
| `opts.headers` | `object` | No | Override headers entirely (still stripped before dispatch). |
| `opts.params` | `any[]` | No | Override `inboundReq.params`. |
| `opts.outerReq` | `cds.Request` | No | Preferred header source when the inner tx request has lost headers (e.g. inside `$expand` fan-out). |
| `opts.fallbackEntityDef` | `object` | No | CSN entity definition used for key resolution when `srv.entities[entityName]` is absent. |

Returns `Promise<any[]>` — always an array; `[]` when dispatch returns nothing.

### `soap.getEntityKeyFields(definition)` — resolve entity key names

Returns the flat list of key-field names for a CSN entity definition. Prefers `definition.keys` (present on all CAP-compiled entities) and falls back to scanning `definition.elements` for entries with `key: true`.

```js
const keys = soap.getEntityKeyFields(srv.entities.BusinessPartner);
// => ['BusinessPartnerID']
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `definition` | `object` | CSN entity definition, e.g. `srv.entities.Foo`. |

Returns `string[]` — zero or more key-field names.

### `soap.dedupByKeys(rows, keyFields)` — deduplicate rows by composite key

Deduplicates a flat row array by the given composite key fields. The first occurrence of each composite key wins. Rows with any `null` / `undefined` key value are passed through unchanged (missing keys cannot establish identity, so dropping them would silently lose data). When `keyFields` is empty the input is returned unchanged.

```js
const unique = soap.dedupByKeys(rows, ['BusinessPartnerID']);
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `rows` | `any[]` | Input row array. |
| `keyFields` | `string[]` | Composite key field names. |

Returns `any[]` — deduped rows in original order.

> **Note.** The composite key is joined with `'||'` as separator. Avoid field values that contain `'||'` if key collision across fields would be a concern.

### `soap.isSoapService(serviceName)` — check if a service is SOAP-backed

Returns `true` when the named service is configured as a SOAP service — either `cds.requires[name].kind === 'soap'` or the CSN definition carries the legacy lower-case `@soap` annotation (the current `@Soap` annotation is not checked here). Safe to call before `cds.services` is populated; relies only on `cds.requires` and `cds.model.definitions`.

```js
if (soap.isSoapService('BP')) {
    // route through SOAP adapter
}
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `serviceName` | `string` | The service name as registered in `cds.requires`. |

Returns `boolean`.

### Types under `soap`

Everything the package exposes, values and types, lives under the single `soap` namespace, so one import is enough:

```ts
import { soap } from '@cap-ts/soap-adapter';

const opts: soap.ReadOptions = { headers: {} };
class BP extends soap.ApplicationService {
    init(): void {
        this.header('BusinessPartner', (req): soap.SoapHeaderObject => ({ value: {} }));
    }
}
```

Available types: `soap.ReadOptions`, `soap.SoapService`, `soap.CdsEntityDef`, `soap.CsnEntityDefinition`, `soap.CreateRequestOptions`, `soap.CdsEntity`, `soap.CdsEntityElement`, `soap.SoapBindingConfig`, `soap.SoapHeaderObject`, `soap.TraceContext`, `soap.BaseAdapterInstance`. There is no top-level export besides `soap`.

---

## ⚙️ Configuration (`cds.env.soap.*`)

[↑ Table of Contents](#-table-of-contents)

Global runtime knobs live under `cds.env.soap` (i.e., the `cds.soap` key in `package.json` / `.cdsrc.json`).

```json
{
  "cds": {
    "soap": {
      "pushFilters": true,
      "pageSize": 1000,
      "multiSelectionConcurrency": 5,
      "idempotency": {
        "enabled": false,
        "ttl": 300000,
        "maxEntries": 1000
      }
    }
  }
}
```

| Key | Type | Default | Description |
| --- | ---- | ------- | ----------- |
| `soap.multiSelectionConcurrency` | `number` | `5` | Batch size for the fan-out of `multipleSelection: false` entities: that many SOAP calls run in parallel, batch after batch. |
| `soap.maxConcurrent` | `number` | `50` | Reserved. A per-destination `p-limit` pool is prepared from it, but the request path does not use it yet. |
| `soap.pushFilters` | `boolean` | `true` | Enables the [`__filterPushedDown` sentinel](#__filterpusheddown-sentinel). Set to `false` to force the in-memory `$filter` / `$orderby` / `$top` / `$skip` evaluator even when a `request()` hook sets the sentinel — useful for A/B testing or when a push-down implementation is suspected of misbehaving. |
| `soap.pageSize` | `number` | `1000` | Default page size for the bounded in-memory fallback when the adapter does **not** set the `__filterPushedDown` sentinel (or when `pushFilters: false`). When the filtered result exceeds one page, the runtime emits an `@odata.nextLink` header and logs a one-time-per-service warning. Hard-capped at `5000` regardless of override. |
| `soap.idempotency.enabled` | `boolean` | `false` | Reserved for write-handler support, which is not shipped: the adapter is read only, so this has no effect today. |
| `soap.idempotency.ttl` | `number` (ms) | `300000` | Cache TTL for idempotency keys (5 minutes). |
| `soap.idempotency.maxEntries` | `number` | `1000` | LRU eviction threshold for the idempotency cache. |

Per-service configuration lives in `cds.requires.<ServiceName>`:

| Key | Type | Required | Description |
| --- | ---- | -------- | ----------- |
| `kind` | `"soap"` | **Yes** | Marks the service for SOAP handling. |
| `wsdl` | `string` | **Yes** | Path to the WSDL file, relative to `cds.root`. |
| `credentials.destination` | `string` | **Yes** | Destination name, resolved via `@sap-cloud-sdk/connectivity` (BTP destination service, or the `destinations` environment variable locally). Without it the service fails with `No 'credentials.destination' configured`. |
| `credentials.path` | `string` | No | Path appended to the destination URL to form the SOAP endpoint. |

The service is looked up in `cds.requires` by its **short name** (the last segment of the service name).

**Boot validation.** At `served` every `kind: 'soap'` service is checked: `wsdl` set, the file exists, and the path stays
inside `cds.root` (a `../` escape is rejected; `.wsdl` is appended when missing). A failing service is logged
(`[soap] ... — service disabled.`) and the rest of the application starts; with `cds.env.features.strict: true` boot
fails instead (use it in CI).

---

## 🏢 Multi-tenant destinations & JWT propagation

[↑ Table of Contents](#-table-of-contents)

In a multi-tenant SaaS application each subscriber has its own BTP destination. The adapter resolves the destination **per request** using the subscriber JWT from the incoming `Authorization` header, so no code change is needed between single-tenant and multi-tenant deployments.

### How it works

1. The CAP runtime validates the incoming JWT and attaches the tenant context to `req`.
2. On each SOAP dispatch the adapter calls `@sap-cloud-sdk/connectivity`'s `getDestination()` with the caller's JWT (from the request's token info, or the `Authorization: Bearer` header) and tenant.
3. The destination service returns the tenant-specific endpoint URL and credentials; the HTTP call goes through `@sap-cloud-sdk/http-client`, so the destination's authentication type (principal propagation, OAuth2, basic, …) applies.
4. The SOAP client is built from the local WSDL file and cached per service, destination, endpoint URL and tenant.

### Configuration

No extra configuration is needed beyond the standard `credentials.destination` key:

```json
{
  "cds": {
    "requires": {
      "BP": {
        "kind": "soap",
        "wsdl": "srv/external/wsdl/BP.wsdl",
        "credentials": { "destination": "DEST_BP" }
      }
    }
  }
}
```

The destination name is the **provider** destination registered in BTP. For multi-tenant scenarios the Cloud SDK automatically looks up the subscriber-scoped destination first, then falls back to the provider destination — this is standard Cloud SDK behaviour and requires no adapter-specific setup.

### Local development without a BTP destination

Keep `credentials.destination` and define that destination locally through the Cloud SDK's `destinations`
environment variable (for example in a git-ignored `.env` or `default-env.json`):

```bash
destinations='[{"name":"DEST_BP","url":"http://localhost:8080","username":"alice","password":"<password>"}]' cds watch
```

> **Security note.** Never commit destination credentials to source control.

### JWT forwarding details

The caller's JWT is used for the **destination lookup** only. What the backend receives is decided by the
destination: with principal propagation or OAuth2 user token exchange the Cloud SDK derives the outbound credentials
from it; with basic authentication or client credentials the destination's own credentials are used. The inbound
`Authorization` header is never copied into the SOAP call, and a `header()` hook cannot set HTTP headers.

---

## 🔍 Filter push-down & `filterRestriction`

[↑ Table of Contents](#-table-of-contents)

The adapter translates OData `$filter` expressions into SOAP request fields. Understanding the push-down model is essential for entities that require specific filter fields (like SAP S/4HANA BAPIs that mandate a company code or business partner key).

### How filter push-down works

Two paths are supported. **Prefer the opt-in path (A)** for any adapter that can express `$filter` / `$orderby` / `$top` / `$skip` in its SOAP operation's selection criteria — it avoids the in-memory evaluator entirely and lets the SOAP backend paginate.

**Path A — Opt-in via `__filterPushedDown` sentinel (recommended, since 0.1.6).**

1. The CAP OData layer parses `$filter` into a CQN `WHERE` array.
2. Your `request()` hook translates the CQN into the SOAP-native selection criteria and **returns the payload with `__filterPushedDown: true`** set on it (when `cds.env.soap.pushFilters !== false`).
3. The runtime reads and **strips** the sentinel from the payload before the SOAP call — the backend never sees it.
4. The in-memory `$filter` / `$orderby` / `$top` / `$skip` evaluator is **skipped** — the SOAP response is treated as the authoritative page. Only `$select` projection and `$count` still run.

See [`__filterPushedDown` sentinel](#__filterpusheddown-sentinel) for the full contract and an example implementation.

**Path B — Bounded in-memory fallback.**

1. The CAP OData layer parses `$filter` into a CQN `WHERE` array.
2. The `request()` hook reads what it needs from `req.query.SELECT.where` and builds the payload.
3. For `multipleSelection: false` entities with `<first key> in (…)`, the runtime fans out into one SOAP call per value (batches of `multiSelectionConcurrency`) and merges the results.
4. The SOAP result is filtered / sorted / paginated **in Node memory** by the in-memory evaluator, bounded by `cds.env.soap.pageSize` (default `1000`, capped at `5000`). When the filtered set exceeds one page, an `@odata.nextLink` is emitted so the client can paginate, and a **one-time-per-service** `in-memory pagination fallback truncated …` warning is logged suggesting migration to Path A.

### `@Soap.filterRestriction` reference

```cds
@Soap.filterRestriction: {
    mandatoryFields   : [ 'CompanyCode', 'FiscalYear' ],
    multipleSelection : false
}
entity FinancialDocuments { … }
```

**`mandatoryFields`** — array of OData property names that MUST be present in `$filter`. A request missing any mandatory field is rejected with HTTP 400 and a diagnostic message:

```http
GET /soap/fi/FinancialDocuments?$filter=FiscalYear eq '2025'
→ 400 { "error": { "code": "MISSING_MANDATORY_FILTER", "message": "Mandatory filter field(s) missing: CompanyCode" } }
```

**`multipleSelection`** — controls fan-out behaviour:

| Value | `$filter` clause | Runtime behaviour |
| ----- | ---------------- | ----------------- |
| `false` | `BusinessPartnerID in ('BP001','BP002')` | Expands to 2 SOAP calls (one per value, run in parallel); results merged. |
| `false` | `BusinessPartnerID in ('BP001') or Name eq 'x'`, or two `in(…)` on the key | Rejected with HTTP 400 `UNSUPPORTED_MULTI_SELECTION_FILTER`. |
| `false` | `BusinessPartnerID eq 'BP001'` | Single SOAP call. |
| `true` / not set | any | Single SOAP call; the `request()` hook handles `in(…)` itself (or the in-memory evaluator filters the result). |

### `$expand`

The `/soap/**` routes do not accept `$expand` (it is a 400). To combine SOAP entities with others, read them through
another service, for example `@cap-ts/remote-service-adapter`, which expands associations across backends.

---

## 🌐 HTTP endpoints and query options

[↑ Table of Contents](#-table-of-contents)

Per SOAP entity four GET routes are mounted (`<path>` = the service's `@path`, else its short name in lower case):

| Route | Answer |
| --- | --- |
| `/soap/<path>/<Entity>` and `/<path>/<Entity>` | `{ "@odata.context", "@odata.count"?, "@odata.nextLink"?, "value": [...] }` |
| `/soap/<path>/<Entity>/<key>` and `/<path>/<Entity>/<key>` | `{ "@odata.context": "...$entity", ...row }`; 404 `Entity instance not found.` without a row. The key value is compared with the first key element. |

Responses are `application/json;odata.metadata=minimal`. Only GET is mounted; writes through the CAP service are 405.

| Query option | Behavior |
| --- | --- |
| `$filter` | Parsed by a fail-closed parser into CQN: `eq`, `ne`, `gt`, `ge`, `lt`, `le`, `and`, `or`, `not`, `in (...)`, parentheses, string, number (also negative), ISO date-time, boolean and `null` literals, and the functions `startswith`, `endswith`, `contains`, `tolower`, `toupper`, `length`, `concat`, `substring`. Anything else (unknown characters or functions, a function on the left of a comparison, GUID literals, unterminated strings) is a 400, never ignored. `'It''s'` keeps the doubled quote. |
| `$select` | Projection of the answer. |
| `$orderby`, `$top`, `$skip` | Applied in memory unless the adapter pushed them down (`__filterPushedDown`). |
| `$skiptoken` | Treated as `$skip` (so `@odata.nextLink` values work). |
| `$count=true` | `@odata.count`: the total before paging. |
| `$search` | Accepted and ignored. |
| `$expand`, `$apply`, `$format`, any other `$` option | 400 `The system query option "<x>" is not supported by soap endpoint.` |

Authentication: when the entity or service has `@requires` (other than `any`), the route runs CAP's auth middleware
itself (the routes are mounted outside CAP's protocol adapters); no user is 401, a user without one of the roles is 403.

---

## 🔗 Using SOAP entities from other services

[↑ Table of Contents](#-table-of-contents)

The plugin registers each SOAP service as a CAP service (`cds.services.<Name>`), so code in the same application can
read it like any service:

```js
const bp = await cds.connect.to('BP');
const rows = await bp.run(SELECT.from('BP.BusinessPartner').where({ BusinessPartnerID: 'BP001' }));
```

The same pipeline runs (mandatory filters are checked on the HTTP route only): `request()` hooks, the SOAP call,
`response()` hooks, `@Soap.path` mapping and the in-memory `$filter` / `$orderby` / paging. For header isolation and
key de-duplication across nested reads use `soap.read(...)` (below), which creates a fresh request per call. Projections
over SOAP entities in other services are served by `@cap-ts/remote-service-adapter` (`@remote`), which detects
`kind: 'soap'` and uses `soap.read`.

---

## 🔒 Security guarantees

[↑ Table of Contents](#-table-of-contents)

| Guarantee | Detail |
| --- | --- |
| **No credential leakage** | Inbound HTTP headers are never forwarded. Keys on the forbidden list (auth, cookie, SAP Passport, trace headers) are dropped from plain-map `header()` results, and `stripSensitiveHeaders()` removes them from any map you build. |
| **JWT tenant isolation** | Destination resolution uses the subscriber JWT; a tenant cannot access another tenant's destination. |
| **Filter injection prevention** | The filter extractor operates on the parsed CQN tree (not raw `$filter` string), so SQL/SOAP injection via `$filter` is structurally impossible. |
| **No client sharing across tenants** | The SOAP client cache is keyed by service, destination name, endpoint URL and tenant. |
| **`@requires` enforcement** | All routes mounted under `/soap/**` inherit the CAP `@requires` annotation from the service definition. Unauthenticated requests are rejected by the CAP runtime before reaching the adapter. |

### Middleware ordering for consumers

The adapter registers its `/soap/**` routes during CAP's `served` phase. Any transport-layer security middleware (helmet, CORS, rate limiting, body-size caps) **must** be attached in the `bootstrap` phase so it wraps `/soap/**` requests too. The `serve` hook runs after `bootstrap`, so ordering is:

```flow
bootstrap (your middleware)  →  serve (CAP mounts routes)  →  served (adapter mounts /soap/**)
```

**Recommended snippet** — drop into `srv/server.ts` (or `.js`) alongside any other bootstrap wiring:

```ts
import cds = require('@sap/cds');
import helmet = require('helmet');
import cors = require('cors');
import rateLimit = require('express-rate-limit');

cds.on('bootstrap', (app: any) => {
  // 1. Security headers — must be first so it wraps everything downstream.
  app.use(helmet());

  // 2. CORS — restrict to your approuter / trusted origins. Never use `origin: true` in prod.
  app.use(cors({
    origin: process.env.CORS_ALLOWED_ORIGINS?.split(',') ?? false,
    credentials: true,
  }));

  // 3. Rate limiting — protect SOAP endpoints from bursty callers.
  app.use('/soap', rateLimit({
    windowMs: 60_000,     // 1 minute
    max: 120,             // 120 req/min/IP — tune for your workload
    standardHeaders: true,
    legacyHeaders: false,
  }));

  // 4. Then app-specific middleware (body parsers, cov2ap, custom routes)…
});
```

**Why the order matters:**

- `helmet()` and `cors()` before `rateLimit()` so rejected requests still get correct security headers.
- `rateLimit()` scoped to `/soap` avoids penalising OData v2/v4 traffic that flows through cov2ap.
- All three go **before** any `app.use(cov2ap(...))` or body parsers — Express matches middleware in registration order.

**Dependencies to add to your consuming package:**

```json
{
  "dependencies": {
    "helmet": "^7",
    "cors": "^2.8",
    "express-rate-limit": "^7"
  }
}
```

> ⚠️ The adapter does **not** bundle these packages. Consumers own the security posture of their HTTP surface; the adapter only guarantees that its own `/soap/**` handlers do not leak credentials, cache across tenants, or accept unsanitised filter input (see the guarantees table above).

[↑ Table of Contents](#-table-of-contents)

---

## 🚦 Errors and results

[↑ Table of Contents](#-table-of-contents)

Error bodies are `{ "error": { "code", "message", "@Common.numericSeverity": 4 } }`.

| Situation | Status, code |
| --- | --- |
| Unsupported system query option, malformed or unsupported `$filter` | 400 |
| A `mandatoryFields` field missing in `$filter` | 400 `MISSING_MANDATORY_FILTER` |
| A second `in (...)` on the key, or `in` combined with `or`, on a `multipleSelection: false` entity | 400 `UNSUPPORTED_MULTI_SELECTION_FILTER` |
| `@requires` set and no authenticated user / user without the role | 401 / 403 |
| Read by key without a row | 404 `Entity instance not found.` |
| CREATE / UPDATE / DELETE | 405 |
| No adapter class resolved for the entity | 501 |
| SOAP fault, network or destination error, any other failure | 500 `SOAP integration call failed` (details only in the redacted log) |
| One fan-out call fails | the whole request fails |
| Empty answer | `value: []` (`@odata.count: 0` with `$count`) |

---

## 🛠️ Troubleshooting

[↑ Table of Contents](#-table-of-contents)

### Application does not start: `CAPTS_LICENSE_MISSING` / `CAPTS_LICENSE_INVALID` / `CAPTS_LICENSE_EXPIRED`

The licence check of `@cap-ts/soap-adapter` failed in production. The message gives the reason. `MISSING`: `cds.capts.license`
is not set (check that the `CDS_CAPTS_LICENSE` variable reached the app: `cds env get capts`). `INVALID`: the token was
changed or truncated, does not grant `@cap-ts/soap-adapter`, or is bound to another Cloud Foundry org or space. `EXPIRED`: the
grace period is over. Contact SAP-Code-World for a new token. See [Licence](#licence-token).

### Entity not found / `501 Not Implemented`

**Symptom:** `GET /soap/bp/BusinessPartner` returns `404` (no route) or `501` (no adapter class).

**Cause:** The loader skips entities without `@Soap.operation`, and a request fails with 501 when no adapter class was found for the entity. Check that:

1. The entity has `@Soap.operation: '<WsdlOperationName>'` in its `.cds` model.
2. The service is declared with `kind: "soap"` in `cds.requires`.
3. The `.cds` file is reachable from `cds.model` (i.e., it is `using`-imported somewhere in the model graph).
4. The URL uses the service's `@path`, or its short name in lower case.
5. The adapter class resolves (see [Adapter class not loaded](#adapter-class-not-loaded--typeerror--is-not-a-constructor)).

---

### Empty result set

**Symptom:** The SOAP call succeeds (HTTP 200) but the CAP result array is empty.

**Likely causes:**

1. **Wrong `rootResponse`** — the path in `@Soap.rootResponse` / `@Soap.binding.rootResponse` (default `<operation>Response`) does not match the actual response. Log the raw rows in a `response()` hook to see the shape.
2. **Missing `@Soap.path`** — the orchestrator cannot locate the value for an element by name. Add explicit `@Soap.path` annotations.
3. **Filter not pushed down** — the `request()` hook is not reading the filter fields correctly. Log `payload` inside the hook to inspect.

---

### `@Soap.binding` is `undefined` at runtime

**Symptom:** The adapter crashes with `Cannot read properties of undefined (reading 'rootRequest')`.

**Cause:** You are reading `entity['@Soap.binding']` directly. The CDS compiler serialises struct annotations as **flat leaf CSN keys** (`entity['@Soap.binding.rootRequest']`), not as a nested object. The loader's `readSoapStructAnnotation` helper reassembles these — but only after the `served` event fires.

**Fix:** Read binding via the loader API (available after `cds.on('served', …)`), or use the post-loader entity definition from `this.entities` inside `init()`.

---

### WSDL not found / `ENOENT`

**Symptom:** Boot fails with `ENOENT: no such file or directory, open '<path>.wsdl'`.

**Fix:** The `wsdl` path in `cds.requires.<ServiceName>` is resolved relative to `cds.root` (the directory containing `package.json`). Verify the path with:

```bash
node -e "const cds = require('@sap/cds'); console.log(cds.root)"
```

---

### Adapter class not loaded / `TypeError: … is not a constructor`

**Symptom:** Boot logs `adapter specifier … could not be resolved` or throws on instantiation.

**Fix checklist:**

1. The module at the resolved path must `module.exports` the class (not `exports.MyClass`).
2. If using TypeScript, something must load `.ts`: `cds watch` / `cds-tsx`, `tsx`, Node 22.18 or later, or `ts-node`
   (`npm i -D ts-node`). The `Failed to load adapter` error of a `.ts` adapter lists these options.
3. For monorepo sibling packages, ensure the package is listed in `dependencies` and `npm install` has run.

---

### Enable verbose logging

Set the `DEBUG` environment variable before starting `cds watch`:

```bash
DEBUG=soap cds watch
```

This enables the `soap` logger's debug output. Payloads that are logged are redacted. It does not log the raw SOAP XML; use a `response()` hook to inspect raw rows.

---

## 💬 Support & feedback

[↑ Table of Contents](#-table-of-contents)

- **Bug reports & feature requests:** open an issue on the [GitHub repository](https://github.com/cap-ts/soap-adapter/issues).
- **Questions:** use [GitHub Discussions](https://github.com/orgs/cap-ts/discussions).

---

## 📄 License

[↑ Table of Contents](#-table-of-contents)

This package is provided under the terms of the **SAP-Code-World** [Usage License Agreement](LICENSE).

### Licence token

Using `@cap-ts/soap-adapter` in production needs a licence token from SAP-Code-World. The token is a signed text string. The
package checks it when the server starts, offline: no call home, no network access.

Set it as `cds.capts.license`. One setting serves every `@cap-ts` package. Keep it out of source control, like any
other credential:

| Where | How |
| --- | --- |
| Environment variable (Cloud Foundry, Kyma, local shell) | `CDS_CAPTS_LICENSE=<token>`, for example `cf set-env <app> CDS_CAPTS_LICENSE <token>` or an `mta.yaml` `properties` entry |
| Kubernetes secret | mount it as `<CDS_CONFIG root>/capts/license` (see CAP's `CDS_CONFIG` directory mode) |
| Local development | `.cdsrc-private.json`: `{ "capts": { "license": "<token>" } }` |

A licence covers this package only, selected `@cap-ts` packages, or every `@cap-ts` package. Several tokens (for
example one per package) go into the same setting, separated by spaces or commas, or as a JSON array; the best one for
each package is used.

What happens:

| Licence state | Production | Not production |
| --- | --- | --- |
| Valid | `info` log: licensee, expiry date, licence ID | same |
| Expires within 30 days | `warn` log | same |
| Expired, inside the grace period (30 days unless your licence says otherwise) | `error` log; SOAP services keep serving | same |
| Expired after the grace period, invalid, not granted for this package, or not set | the application does not start: error `CAPTS_LICENSE_EXPIRED`, `CAPTS_LICENSE_INVALID` or `CAPTS_LICENSE_MISSING` with the reason | `warn` log; the package runs in evaluation mode |

- **Production** means the cds profile `production` (`NODE_ENV=production`, which the Cloud Foundry Node.js buildpack
  sets) or running on Cloud Foundry.
- The check only runs when at least one `cds.requires` entry has `kind: "soap"`. An app that only has the package
  installed needs no licence.
- A licence can be bound to Cloud Foundry org or space GUIDs. It is then only valid in those orgs or spaces.
- A running application is never stopped. Renewing means setting the new token and restarting the app.

© 2025 **SAP-Code-World**. All rights reserved.
