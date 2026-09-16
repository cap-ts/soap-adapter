# @cap-ts/soap-adapter

[![Version npm](https://img.shields.io/npm/v/@cap-ts/soap-adapter.svg)](https://www.npmjs.com/package/@cap-ts/soap-adapter)

> **CAP plugin for SOAP Adapter that lets `@sap/cds` services expose OData v4 entities backed by legacy SOAP web services.**
> Node.js ≥ 18, `@sap/cds` v7 / v8 / v9.

## 📦 About

`@cap-ts/soap-adapter` turns a WSDL operation into a CAP entity: consumers declare the entity in `.cds` with a small set of `@Soap.*` annotations, ship an adapter subclass that shapes the SOAP request/response, and the plugin does the rest — CSRF-safe HTTP routing (`/soap/**`), destination + JWT propagation, filter push-down, XML build/parse, response flattening, and CAP OData v4 exposure.

---

## 📑 Table of Contents

📥 [Installation](#-installation)\
📖 [Usage Guidelines](#-usage-guidelines)\
⚡ [Quick start (5 minutes)](#-quick-start-5-minutes)\
📝 [CDS annotation reference (`@Soap.*`)](#-cds-annotation-reference-soap)\
🔌 [Adapter class API (`soap.ApplicationService`)](#-adapter-class-api-soapapplicationservice)\
🧰 [Utility API (`soap.*`)](#-utility-api-soap)\
⚙️ [Configuration (`cds.env.soap.*`)](#️-configuration-cdsenvsoap)\
🏢 [Multi-tenant destinations & JWT propagation](#-multi-tenant-destinations--jwt-propagation)\
🔍 [Filter push-down & `filterRestriction`](#-filter-push-down--filterrestriction)\
🔒 [Security guarantees](#-security-guarantees)\
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

| Peer | Minimum | Notes |
| --- | --- | --- |
| `@sap/cds` | 7.0 | Tested against 7, 8, 9. |
| Node.js | 18 | Uses `crypto.randomUUID`, `structuredClone`, top-level `require('node:test')` for tests. |
| `@sap-cloud-sdk/http-client` | 4.7 | Auto-installed. |
| `@sap-cloud-sdk/connectivity` | 4.7 | Auto-installed. Provides destination resolution + JWT forwarding. |
| `soap` | 1.10 | Auto-installed. |
| `p-limit` | 6.2 | Auto-installed. |

Optional but recommended:

| Dep | When | Notes |
| --- | --- | --- |
| `ts-node` | You author adapter classes in TypeScript | The loader registers `ts-node/transpile-only` on demand and logs a `warn` if it's missing. |

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
        CAP OData v4 endpoint at `/soap/<path/service>/**`
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

        this.header(BusinessPartner, (req) => ({
            // Strip inbound HTTP auth/session/trace before propagating.
            ...soap.ApplicationService.stripSensitiveHeaders(req.headers ?? {}),
            'SOAPAction': '"GetBusinessPartner"'
        }));

        this.request(BusinessPartner, (req, payload) => {
            // Shape the SOAP body from the incoming CAP $filter.
            const key = req.query?.SELECT?.where; // CQN WHERE array
            return { BusinessPartnerID: extractBpId(key) };
        });

        this.response(BusinessPartner, (req, rows) => {
            // Rows have already been flattened per `@Soap.path` — massage further if needed.
            return rows.map(r => ({ ...r, FullName: r.FullName?.trim() }));
        });
    }
}
module.exports = BP;
```

**4. Start `cds watch`.** The loader will mount:

- `/soap/BP/BusinessPartner` — raw SOAP-over-HTTP route (@requires-enforced).

---

## 📝 CDS annotation reference (`@Soap.*`)

[↑ Table of Contents](#-table-of-contents)

All six annotations are declared in the package's `index.cds` under the single canonical top-level namespace. They are real CDS typed annotations, so `cds compile` type-checks consumer usage — typos and shape mismatches surface at build time, not at first request.

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
| `rootRequest` | Yes | SOAP element name used to wrap the outbound payload. Must match the WSDL operation's `<input message>` root. |
| `rootResponse` | No | SOAP response element whose contents become the CAP result. If omitted the loader falls back to `@Soap.rootResponse` (scalar), then to a heuristic derived from the operation name. |

### `@Soap.operation` *(scalar, entity-level)* — **required**

WSDL operation name serviced for SELECT / READ requests on this entity.

```cds
@Soap.operation: 'GetBusinessPartner'
entity BusinessPartner { … }
```

An entity without an `@Soap.operation` is invisible to the loader — no route is mounted, no CAP handler registered. This is the load-time gate.

### `@Soap.rootResponse` *(scalar, entity-level)* — optional

Only consulted when `@Soap.binding.rootResponse` is absent. Documents the SOAP response element to unwrap.

### `@Soap.path` *(scalar, element-level)*

Explicit dot-path override applied when the orchestrator walks a raw SOAP response tree to locate the value for this element.

```cds
entity BusinessPartner {
    key BusinessPartnerID : String;
        @Soap.path : 'data.Address.CountryCode'
        CountryCode : String;
}
```

Without `@Soap.path`, the orchestrator matches by element name (case-sensitive) and falls back to a structural best-guess. `@Soap.path` short-circuits both, which is essential when SOAP responses nest values several levels deep or when element names collide across namespaces.

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
| `multipleSelection` | `Boolean` (default `true`) | When `false`, `$filter` on any mandatory field must be a single equality clause. `in(…)` / `or` / `ne` combinations are rejected as 400. The runtime expands `key in (a,b,c)` into N parallel SOAP calls only when `multipleSelection: true`. |

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

Registers a hook that produces additional HTTP headers for every outbound SOAP call for `entity`.

```js
this.header(BusinessPartner, (req) => ({
    'SOAPAction': '"GetBusinessPartner"',
    'X-Correlation-ID': req.headers['x-correlation-id'] ?? crypto.randomUUID()
}));
```

- `req` — the incoming CAP `Request` object.
- Return value: a plain `Record<string, string>`. Merged on top of the base headers computed by the runtime. Returning `null` / `undefined` is a no-op.
- Called once per SOAP dispatch (including fan-out calls for `multipleSelection: true`).

### `this.request(entity, fn)` — outbound SOAP payload

Registers a hook that shapes the SOAP request body for `entity`.

```js
this.request(BusinessPartner, (req, payload) => {
    // payload is the runtime-built object before XML serialisation.
    // Augment or replace it entirely.
    return { ...payload, Language: req.locale ?? 'EN' };
});
```

- `req` — incoming CAP `Request`.
- `payload` — the pre-built payload object (already includes filter-extracted fields). Mutate or replace.
- Return value: the object to serialise into the SOAP `<Body>` wrapped under `rootRequest`.
- Returning `undefined` falls back to the runtime-built payload.

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

**When push-down is not set** (sentinel absent or `pushFilters: false`), the runtime falls back to the bounded in-memory evaluator (`cds.env.soap.pageSize`, default `1000`, capped at `5000`) and emits an `@odata.nextLink` header when the result exceeds one page.

### `this.mock(entity, fn)` — offline / test mock

Registers a mock handler that **replaces** the actual SOAP call. Useful for unit tests and offline development.

```js
this.mock(BusinessPartner, (req) => {
    return [{ BusinessPartnerID: 'BP001', FullName: 'ACME Corp' }];
});
```

- Return value: array of raw row objects (same shape as the SOAP response would produce — **before** `@Soap.path` flattening).
- When a mock is registered the runtime skips destination resolution, WSDL loading, and HTTP dispatch entirely.
- Mocks are **not** active in production builds (`NODE_ENV=production`); registering one logs a `warn`.

### `this.response(entity, fn)` — inbound result transform

Registers a hook that post-processes the result before they are returned to the CAP OData layer.

```js
this.response(BusinessPartner, (req, rows) => {
    return rows
        .filter(r => r.Active === 'X')
        .map(r => ({ ...r, FullName: r.FullName?.trim() ?? '' }));
});
```

- `req` — the incoming CAP `Request`.
- `rows` — array of objects already flattened by `@Soap.path` resolution. Each object has one key per entity element.
- Return value: the final rows array passed to CAP. Must be an array; returning `undefined` falls back to `rows` unchanged.

### `soap.ApplicationService.stripSensitiveHeaders(headers)` — static helper

Strips inbound HTTP headers that must never be forwarded to a backend SOAP service (auth tokens, session cookies, SAP passport, trace/correlation identifiers).

```js
this.header(BusinessPartner, (req) => ({
    ...soap.ApplicationService.stripSensitiveHeaders(req.headers ?? {}),
    'SOAPAction': '"GetBusinessPartner"'
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
this.header(BusinessPartner, (req) => {
    const clean = {};
    for (const [k, v] of Object.entries(req.headers ?? {})) {
        if (!myForbidden.has(k.toLowerCase())) clean[k] = v;
    }
    return clean;
});
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
      headwrs: ...,
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

Returns `true` when the named service is configured as a SOAP service — either `cds.requires[name].kind === 'soap'` or the CSN definition carries the `@soap` annotation. Safe to call before `cds.services` is populated; relies only on `cds.requires` and `cds.model.definitions`.

```js
if (soap.isSoapService('BP')) {
    // route through SOAP adapter
}
```

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `serviceName` | `string` | The service name as registered in `cds.requires`. |

Returns `boolean`.

---

## ⚙️ Configuration (`cds.env.soap.*`)

[↑ Table of Contents](#-table-of-contents)

Global runtime knobs live under `cds.env.soap` (i.e., the `cds.soap` key in `package.json` / `.cdsrc.json`).

```json
{
  "cds": {
    "soap": {
      "maxConcurrent": 50,
      "pushFilters": true,
      "pageSize": 1000,
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
| `soap.maxConcurrent` | `number` | `50` | Maximum number of parallel outbound SOAP calls per service instance. Enforced by `p-limit`. Fan-out calls (from `multipleSelection: true`) share this pool. |
| `soap.pushFilters` | `boolean` | `true` | Enables the [`__filterPushedDown` sentinel](#__filterpusheddown-sentinel). Set to `false` to force the in-memory `$filter` / `$orderby` / `$top` / `$skip` evaluator even when a `request()` hook sets the sentinel — useful for A/B testing or when a push-down implementation is suspected of misbehaving. |
| `soap.pageSize` | `number` | `1000` | Default page size for the bounded in-memory fallback when the adapter does **not** set the `__filterPushedDown` sentinel (or when `pushFilters: false`). When the filtered result exceeds one page, the runtime emits an `@odata.nextLink` header and logs a one-time-per-service warning. Hard-capped at `5000` regardless of override. |
| `soap.idempotency.enabled` | `boolean` | `false` | Feature flag — reserved for write-handler support (not yet shipped). When `true`, duplicate SOAP requests within the TTL window are short-circuited with a cached response. |
| `soap.idempotency.ttl` | `number` (ms) | `300000` | Cache TTL for idempotency keys (5 minutes). |
| `soap.idempotency.maxEntries` | `number` | `1000` | LRU eviction threshold for the idempotency cache. |

Per-service configuration lives in `cds.requires.<ServiceName>`:

| Key | Type | Required | Description |
| --- | ---- | -------- | ----------- |
| `kind` | `"soap"` | **Yes** | Marks the service for SOAP handling. |
| `wsdl` | `string` | **Yes** | Path to the WSDL file, relative to `cds.root`. |
| `credentials.destination` | `string` | Yes (BTP) | BTP destination name. Resolved via `@sap-cloud-sdk/connectivity`. |
| `credentials.url` | `string` | Yes (local) | Direct SOAP endpoint URL. Used when no BTP destination is configured (local dev / on-premise). |
| `credentials.username` / `password` | `string` | No | Basic-auth credentials. Only used when `url` is set (not for BTP destinations — those carry credentials in the destination itself). |

---

## 🏢 Multi-tenant destinations & JWT propagation

[↑ Table of Contents](#-table-of-contents)

In a multi-tenant SaaS application each subscriber has its own BTP destination. The adapter resolves the destination **per request** using the subscriber JWT from the incoming `Authorization` header, so no code change is needed between single-tenant and multi-tenant deployments.

### How it works

1. The CAP runtime validates the incoming JWT and attaches the tenant context to `req`.
2. On each SOAP dispatch the adapter calls `@sap-cloud-sdk/connectivity`'s `getDestination()` with the subscriber tenant token extracted from `req.http.req.headers.authorization`.
3. The destination service returns the tenant-specific endpoint URL and credentials.
4. The WSDL is re-fetched (and cached per tenant+destination) if the endpoint differs from a previously seen one.

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

Use `credentials.url` + optional `credentials.username` / `credentials.password` in your `cds.env` override (`.cdsrc-private.json` or environment variables):

```json
{
  "cds": {
    "requires": {
      "BP": {
        "credentials": {
          "url": "http://localhost:8080/soap/BP",
          "username": "alice",
          "password": "Alice@Cap#"
        }
      }
    }
  }
}
```

> **Security note.** Never commit `credentials.password` to source control. Use `.cdsrc-private.json` (git-ignored) or the `CDS_REQUIRES_BP_CREDENTIALS_PASSWORD` environment variable pattern.

### JWT forwarding details

The adapter propagates the subscriber JWT as a Bearer token in the `Authorization` header of the outbound SOAP call **unless** the `header()` hook returns its own `Authorization` key (which takes precedence). Use `stripSensitiveHeaders()` in your `header()` hook if you want to suppress forwarding entirely:

```js
this.header(BusinessPartner, (req) => ({
    ...soap.ApplicationService.stripSensitiveHeaders(req.headers ?? {}),
    // No Authorization key → runtime does NOT forward the inbound JWT.
    'SOAPAction': '"GetBusinessPartner"'
}));
```

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
2. The loader's filter extractor walks the CQN tree and produces a flat `{ fieldName: value | value[] }` map.
3. The runtime passes this map to the `request()` hook as part of `payload`.
4. For `multipleSelection: false` entities with an `in(…)` filter, the runtime fans out into N sequential/parallel SOAP calls (one per value) and merges results.
5. The SOAP result is filtered / sorted / paginated **in Node memory** by the in-memory evaluator, bounded by `cds.env.soap.pageSize` (default `1000`, capped at `5000`). When the filtered set exceeds one page, an `@odata.nextLink` is emitted so the client can paginate, and a **one-time-per-service** `in-memory pagination fallback truncated …` warning is logged suggesting migration to Path A.

### `@Soap.filterRestriction` reference

```cds
@Soap.filterRestriction: {
    mandatoryFields   : [ 'CompanyCode', 'FiscalYear' ],
    multipleSelection : false
}
entity e_FinancialDocument { … }
```

**`mandatoryFields`** — array of OData property names that MUST be present in `$filter`. A request missing any mandatory field is rejected with HTTP 400 and a diagnostic message:

```http
GET /soap/FI/e_FinancialDocument?$filter=FiscalYear eq '2025'
→ 400 Bad Request: Filter field 'CompanyCode' is mandatory for e_FinancialDocument
```

**`multipleSelection`** — controls fan-out behaviour:

| Value | `$filter` clause | Runtime behaviour |
| ----- | ---------------- | ----------------- |
| `true` (default) | `BusinessPartnerID in ('BP001','BP002')` | Expands to 2 parallel SOAP calls; results merged. |
| `false` | `BusinessPartnerID in ('BP001','BP002')` | Rejected with HTTP 400. |
| `false` | `BusinessPartnerID eq 'BP001'` | Single SOAP call. |

### Combining mandatory fields with `$expand`

When an entity is used as a value-help target (via `$expand` from a parent entity), the parent's key fields are automatically injected into the filter map — `mandatoryFields` validation still applies. Ensure the parent passes all required keys as association keys.

---

## 🔒 Security guarantees

[↑ Table of Contents](#-table-of-contents)

| Guarantee | Detail |
| --- | --- |
| **No credential leakage** | `stripSensitiveHeaders()` removes auth, cookie, and SAP Passport headers before outbound dispatch. Adapters that call it in `header()` are safe by default. |
| **JWT tenant isolation** | Destination resolution uses the subscriber JWT; a tenant cannot access another tenant's destination. |
| **Filter injection prevention** | The filter extractor operates on the parsed CQN tree (not raw `$filter` string), so SQL/SOAP injection via `$filter` is structurally impossible. |
| **No WSDL caching across tenants** | WSDL cache is keyed by `tenant + destination name + endpoint URL`. A WSDL change on one tenant does not affect others. |
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

## 🛠️ Troubleshooting

[↑ Table of Contents](#-table-of-contents)

### Entity not found / `501 Not Implemented`

**Symptom:** `GET /soap/BP/BusinessPartner` returns `501` or the entity is missing from the service document.

**Cause:** The loader skips entities without `@Soap.operation`. Check that:

1. The entity has `@Soap.operation: '<WsdlOperationName>'` in its `.cds` model.
2. The service is declared with `kind: "soap"` in `cds.requires`.
3. The `.cds` file is reachable from `cds.model` (i.e., it is `using`-imported somewhere in the model graph).

---

### Empty result set

**Symptom:** The SOAP call succeeds (HTTP 200) but the CAP result array is empty.

**Likely causes:**

1. **Wrong `rootResponse`** — the element name in `@Soap.binding.rootResponse` does not match the actual WSDL response wrapper. Open the raw SOAP response (enable `DEBUG=soap` logging) and verify the element name.
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
2. If using TypeScript, `ts-node` must be installed (`npm i -D ts-node`).
3. For monorepo sibling packages, ensure the package is listed in `dependencies` and `npm install` has run.

---

### Enable verbose logging

Set the `DEBUG` environment variable before starting `cds watch`:

```bash
DEBUG=soap cds watch
```

This enables per-request logging of: destination resolution, WSDL load, outbound headers (with sensitive values redacted), raw SOAP request/response XML, and filter extraction.

---

## 💬 Support & feedback

[↑ Table of Contents](#-table-of-contents)

- **Bug reports & feature requests:** open an issue on the [GitHub repository](https://github.com/cap-ts/soap-adapter/issues).
- **Questions:** use [GitHub Discussions](https://github.com/orgs/cap-ts/discussions).

---

## 📄 License

[↑ Table of Contents](#-table-of-contents)

This package is provided under the terms of the **SAP-Code-World** [Usage License Agreement](LICENSE).

© 2025 **SAP-Code-World**. All rights reserved.
