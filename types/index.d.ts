/**
 * @module @cap-ts/soap-adapter
 * @description
 * Public entry point for `@cap-ts/soap-adapter`.
 *
 * Exposes the `soap` namespace containing the public API surface:
 *
 * | Symbol | Description |
 * |--------|-------------|
 * | `ApplicationService` | Base class for consumer-side SOAP adapter implementations. |
 * | `FORBIDDEN_SOAP_HEADERS` | Frozen list of header names stripped from outbound SOAP requests. |
 * | `createRequest` | Factory for constructing CAP `cds.Request`-compatible objects. |
 * | `getEntityKeyFields` | Extracts the key field names from a CSN entity definition. |
 * | `dedupByKeys` | Deduplicates a record array by a composite key. |
 * | `isSoapService` | Predicate — returns `true` when a CDS service is SOAP-bound. |
 * | `read` | Convenience wrapper for issuing a READ against a SOAP service. |
 *
 * @example
 * ```ts
 * // CAP plugin wiring (package.json cds.requires):
 * // "soap-adapter": { "impl": "@cap-ts/soap-adapter" }
 *
 * // Adapter class usage:
 * const { soap } = require('@cap-ts/soap-adapter');
 * class MyAdapter extends soap.ApplicationService { ... }
 * ```
 */
import { ApplicationService, createRequest, getEntityKeyFields, dedupByKeys, isSoapService, read } from './lib';
/**
 * The `soap` namespace. Both the ESM and CJS surfaces expose this exact object
 * plus each member as a flat named export, so the two module formats always
 * agree on shape.
 */
declare const soap: {
    /**
     * Abstract base class for per-entity SOAP adapters. Subclass it, override
     * `init()` and register hooks with `header()`, `request()`, `mock()` and
     * `response()`.
     *
     * Constructor: `new (entity, req, traceContext)` — invoked by the loader,
     * never directly.
     *
     * @example
     * class ProductSet extends soap.ApplicationService {
     *     init() {
     *         this.request('ProductSet', async (req) => ({ ProductID: req.data.ID }));
     *         this.response('ProductSet', (req, rows) => rows.map(r => ({ ...r, _source: 'soap' })));
     *     }
     * }
     */
    ApplicationService: typeof ApplicationService;
    /**
     * Frozen list of lower-case HTTP header names that are never forwarded
     * to a SOAP backend (auth, cookies, forwarded-identity, trace IDs, CSRF).
     * Clone it to extend; mutating it throws in strict mode.
     *
     * @example
     * const mine = [...soap.FORBIDDEN_SOAP_HEADERS, 'x-my-header'];
     */
    FORBIDDEN_SOAP_HEADERS: typeof ApplicationService.FORBIDDEN_SOAP_HEADERS;
    /**
     * Creates a real `cds.Request` for SOAP dispatch.
     *
     * @param opts - Single options object: `event` and `query` (required);
     *   `data`, `headers`, `target`, `params`, `user`, `http` (optional).
     * @returns A fully initialised `cds.Request` with a unique context id.
     * @example
     * const req = soap.createRequest({
     *     event: 'READ',
     *     query: SELECT.from('ext.BusinessPartnerSet'),
     *     user: inboundReq.user,
     * });
     */
    createRequest: typeof createRequest;
    /**
     * Resolves the flat list of key-field names for a CSN entity definition
     * (prefers `definition.keys`, falls back to `key: true` elements).
     *
     * @param definition - CSN entity definition, e.g. `srv.entities.Foo`.
     * @returns Zero or more key-field names.
     * @example
     * const keys = soap.getEntityKeyFields(srv.entities.BusinessPartnerSet);
     */
    getEntityKeyFields: typeof getEntityKeyFields;
    /**
     * Deduplicates a row array by composite key; the first occurrence wins.
     * Rows with a `null`/`undefined` key value pass through unchanged, and an
     * empty `keyFields` returns the input as-is.
     *
     * @param rows - Array of plain objects (SOAP response rows).
     * @param keyFields - Field names forming the composite key.
     * @returns Deduplicated rows in original order.
     * @example
     * const unique = soap.dedupByKeys(rows, ['BusinessPartnerID']);
     */
    dedupByKeys: typeof dedupByKeys;
    /**
     * Returns `true` when the named service is SOAP-backed, i.e.
     * `cds.requires[name].kind === 'soap'` or its CSN definition carries the
     * `@soap` annotation. Safe to call before `cds.services` is populated.
     *
     * @param serviceName - Fully-qualified or short CDS service name.
     * @returns `true` for a SOAP service, otherwise `false`.
     * @example
     * if (soap.isSoapService('ext.BusinessPartnerService')) { … }
     */
    isSoapService: typeof isSoapService;
    /**
     * One-shot SOAP read: assembles headers, builds a real `cds.Request`,
     * dispatches it and deduplicates the result by entity key fields.
     *
     * @param srv - The SOAP service instance.
     * @param entity - Key into `srv.entities`; used for key resolution and as the request target.
     * @param req - Inbound CAP request (source of user, params, headers).
     * @param query - CQN SELECT query passed to `createRequest`.
     * @param opts - Optional overrides: `headers`, `params`, `outerReq`, `fallbackEntityDef`.
     * @returns Always an array; `[]` when dispatch returns nothing.
     * @example
     * const rows = await soap.read(srv, 'BusinessPartnerSet', req, SELECT.from('BusinessPartnerSet'));
     */
    read: typeof read;
};
export type { ReadOptions } from './lib';
export { soap };
//# sourceMappingURL=index.d.ts.map