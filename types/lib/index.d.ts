/**
 * @module @cap-ts/soap-adapter/lib
 * @description Public API surface of the `@cap-ts/soap-adapter` library.
 *
 * Exports {@link Service} — the CAP service class that every SOAP adapter
 * extends — along with {@link FORBIDDEN_SOAP_HEADERS} and a set of re-exported
 * utilities (`createRequest`, `getEntityKeyFields`, `dedupByKeys`,
 * `isSoapService`, `read`).
 *
 * The loader (`_loader/index`) resolves the subclass of a SOAP service
 * (`@Soap.adapter`, `cds.requires.<Service>.impl` or the file convention),
 * constructs it once as the CAP service and awaits its `init()`.
 *
 * @see {@link Service}
 * @see {@link FORBIDDEN_SOAP_HEADERS}
 */
import type { Request, Service as CdsService } from '@sap/cds';
/**
 * The internal CAP service that runs the READ pipeline (`_base`). Typed as `cds.Service` so the published
 * declarations stay self-contained.
 */
declare const BaseService: typeof CdsService;
/**
 * Minimal shape of a CAP CSN entity reflection object as seen at runtime.
 * The full `cds.linked` entity carries many more fields; only the subset
 * consumed by the adapter framework is declared here.
 *
 * @interface CdsEntity
 * @property {string} name - Fully qualified entity name, e.g.
 *   `'ext.BusinessPartners'`.
 * @property {Record<string, CdsEntityElement>} elements - Map of element
 *   (field) name → element descriptor.
 * @property {SoapBindingConfig} [@Soap.binding] - Optional SOAP binding
 *   annotation placed on the entity in the `.cds` model.
 * @property {{ name: string }} parent - The parent service or namespace
 *   object.
 */
export interface CdsEntity {
    name: string;
    elements: Record<string, CdsEntityElement>;
    '@Soap.binding'?: SoapBindingConfig;
    parent: {
        name: string;
    };
    [key: string]: unknown;
}
/**
 * Descriptor for a single element (field) of a CDS entity as returned by
 * `cds.linked` reflection.
 *
 * @interface CdsEntityElement
 * @property {string} [type] - CDS type name, e.g. `'cds.String'`.
 * @property {string} [@Soap.path] - XPath-like path within the SOAP
 *   response document that this element maps to.
 */
export interface CdsEntityElement {
    type?: string;
    '@Soap.path'?: string;
    [key: string]: unknown;
}
/**
 * Value of the `@Soap.binding` annotation on a CDS entity, as the loader
 * assembles it when the service starts.
 *
 * @interface SoapBindingConfig
 * @property {string} operation - SOAP operation name (WSDL `<operation>`),
 *   e.g. `'GetBusinessPartnerCollection'`.
 * @property {string} [rootRequest] - Optional XPath root element to wrap
 *   the outbound SOAP request payload in.
 * @property {string} [rootResponse] - Optional XPath root element to unwrap
 *   from the inbound SOAP response before mapping.
 */
export interface SoapBindingConfig {
    operation: string;
    rootRequest?: string;
    rootResponse?: string;
}
/**
 * The entity a hook is registered for: its name, qualified (`'ext.BusinessPartner'`) or not (`'BusinessPartner'`), or
 * any object with a `name`, such as an entity of `this.entities` (CAP's entity type) or a {@link CdsEntity}.
 */
export type HookTarget = string | {
    name: string;
};
/**
 * A single SOAP header entry.  Either a static object passed directly to
 * `header()` or the resolved return value of a `SoapHeaderEvaluator`
 * callback.
 *
 * @interface SoapHeaderObject
 * @property {*} [value] - Header value (string or structured object
 *   depending on the WSDL contract).
 * @property {string} [name] - Local name of the SOAP header element.
 * @property {string} [prefix] - XML namespace prefix, e.g. `'wsse'`.
 * @property {string} [xmlns] - XML namespace URI bound to `prefix`.
 */
export interface SoapHeaderObject {
    value?: unknown;
    name?: string;
    prefix?: string;
    xmlns?: string;
    [key: string]: unknown;
}
/**
 * Frozen, read-only list of HTTP header names that must **never** flow from
 * an inbound CAP request into an outbound SOAP call.
 *
 * Covers:
 * - **Auth material**: `authorization`, `proxy-authorization`, `saml-token`,
 *   `x-forwarded-authorization`.
 * - **Session cookies**: `cookie`, `set-cookie`.
 * - **Forwarded-identity metadata**: `x-forwarded-for`, `x-forwarded-host`,
 *   `x-forwarded-proto`, `x-real-ip`.
 * - **Platform trace / correlation IDs**: `x-request-id`, `x-correlation-id`,
 *   `x-vcap-request-id`, `x-cf-app-instance`, `x-b3-*`, `traceparent`,
 *   `tracestate`, `sap-passport`.
 * - **Security tokens**: `x-csrf-token`, `sec-websocket-key`,
 *   `sec-websocket-accept`.
 *
 * The list is exposed as `Service.FORBIDDEN_SOAP_HEADERS` so
 * consumers can inspect it.  It is frozen; mutating it will throw in strict
 * mode.  To extend it, clone the array and add your own entries.
 *
 * @see {@link Service.stripSensitiveHeaders}
 */
declare const FORBIDDEN_SOAP_HEADERS: readonly string[];
/**
 * The CAP service of a SOAP web service (`cds.requires.<Service>.kind: 'soap'`).
 *
 * Consumers subclass it once per SOAP service, register their hooks
 * ({@link Service#header}, {@link Service#request}, {@link Service#mock},
 * {@link Service#response}) in `init()` and end `init()` with
 * `await super.init()`, which registers the READ pipeline. The class is found
 * through `@Soap.adapter` on the service, `cds.requires.<Service>.impl`, or the
 * file `<Service>.js` / `<Service>.ts` in the folder of the service's `.cds`
 * file, its `lib/` or its `handlers/` sub-folder.
 *
 * **Contract:**
 * - **One instance per service**, constructed by the plugin (or by CAP) like
 *   any CAP service: `new (name, model, options)`, then `await init()`. Keep no
 *   request state on `this`; every hook gets the current request as `req`.
 * - **CAP handlers work as usual**: `this.before`, `this.on` and `this.after`
 *   registered before `await super.init()` run around (or instead of) the SOAP
 *   READ pipeline; call `next()` in an `on` handler to reach it.
 * - **Hooks are dispatched by unqualified entity short-name** (e.g.
 *   `'BusinessPartner'`, not `'ext.BusinessPartner'`). The `targets`
 *   parameter of each registration method accepts strings, CSN entity
 *   objects, arrays of either, or comma-separated strings.
 *
 * @example
 * // srv/external/lib/BusinessPartnerService.js
 * class BusinessPartnerService extends soap.Service {
 *     async init() {
 *         this.request('Products', async (req) => ({
 *             ProductID: req.data.ID,
 *         }));
 *         this.response('Products', (req, rows) =>
 *             rows.map(r => ({ ...r, _source: 'soap' }))
 *         );
 *         await super.init();
 *     }
 * }
 * module.exports = BusinessPartnerService;
 */
declare class Service extends BaseService {
    /**
     * Frozen array of HTTP header names that must never be forwarded to a
     * SOAP backend.  Used by {@link Service.stripSensitiveHeaders}.
     * @static
     * @readonly
     * @public
     */
    static readonly FORBIDDEN_SOAP_HEADERS: readonly string[];
    /**
     * Per-entity ordered list of outbound payload transformer functions
     * registered via {@link Service#request}.
     * @protected
     */
    protected _requestHandlers: Record<string, Array<(req: Request, payload: unknown) => Promise<unknown> | unknown>>;
    /**
     * Per-entity ordered list of response mapper functions registered via
     * {@link Service#response}.
     * @protected
     */
    protected _responseHandlers: Record<string, Array<(req: Request, rows: object[]) => Promise<object[]> | object[]>>;
    /**
     * Per-entity mock replacement functions registered via
     * {@link Service#mock}.  Only one mock per entity; the last
     * registration wins.
     * @protected
     */
    protected _mockHandlers: Record<string, (req: Request, payload: unknown) => Promise<unknown>>;
    /**
     * Per-entity header providers (static objects or evaluator functions)
     * registered via {@link Service#header}.
     * @protected
     */
    protected _headerHandlers: Record<string, Array<SoapHeaderObject | ((req: Request, payload: unknown) => Promise<SoapHeaderObject> | SoapHeaderObject)>>;
    /**
     * Return a shallow copy of `headers` with every key that appears in
     * {@link FORBIDDEN_SOAP_HEADERS} removed (comparison is
     * case-insensitive — keys are lower-cased before matching).
     *
     * Non-object or falsy input returns an empty object `{}` rather than
     * throwing, so callers can safely pass `req.headers ?? {}` without a
     * guard.
     *
     * The allowlist is exposed as `Service.FORBIDDEN_SOAP_HEADERS`
     * (frozen).  Consumers can extend it by cloning the array and adding
     * extra entries; mutating the exported constant throws in strict mode.
     *
     * @param {Record<string, *>} headers - The raw HTTP headers object to
     *   sanitise (e.g. `req.headers`).
     * @returns {Record<string, *>} A new object containing only the headers
     *   that are safe to forward to the SOAP backend.
     * @example
     * // Inside a header() hook:
     * this.header(Entity, (req) =>
     *     soap.Service.stripSensitiveHeaders(req.headers ?? {})
     * );
     * @static
     * @public
     */
    static stripSensitiveHeaders(headers: Record<string, unknown>): Record<string, unknown>;
    /**
     * Normalise a `targets` argument into a flat, deduplicated list of
     * unqualified entity short-names used as internal dispatch keys.
     *
     * Accepted input forms:
     * - **CSN entity object** (`{ name: 'ext.BusinessPartner', … }`) →
     *   returns `['BusinessPartner']` (last segment after the last `.`).
     * - **Qualified string** (`'ext.BusinessPartner'`) → same as above.
     * - **Unqualified string** (`'BusinessPartner'`) → returned as-is.
     * - **Comma-separated string** (`'A,ext.B'`) → split, trimmed, and
     *   each entry normalised individually.
     * - **Array** of any of the above → recursively flattened.
     * - `null` / `undefined` / empty string → returns `[]`.
     *
     * @param {HookTarget|HookTarget[]|null|undefined} targets
     *   - One or more entity references to normalise.
     * @returns {string[]} Zero or more unqualified entity short-names.
     * @private
     */
    private _resolveEntityNames;
    /**
     * Register SOAP header providers for one or more entities.
     *
     * `handler` may be either:
     * - A **static** {@link SoapHeaderObject} that is attached verbatim to
     *   every outbound SOAP call for the matched entities.
     * - An **evaluator function** `(req, data) => SoapHeaderObject` (sync or
     *   async) that is called per request and may inspect `req` to build the
     *   header dynamically.
     *
     * Multiple registrations for the same entity are all invoked in
     * registration order.  The same handler reference passed twice for the
     * same entity is de-duplicated (only the first registration is kept).
     *
     * Common use: strip sensitive inbound HTTP headers before forwarding
     * them to the SOAP backend — see
     * {@link Service.stripSensitiveHeaders}.
     *
     * @param {HookTarget|HookTarget[]} targets - One or
     *   more entity references that this header provider applies to.
     * @param {SoapHeaderObject|((req: Request, payload: *) => Promise<SoapHeaderObject>|SoapHeaderObject)} handler
     *   - Static header object or evaluator function.
     * @throws {Error} If `handler` is neither a function nor an object.
     * @returns {void}
     * @public
     */
    header(targets: HookTarget | HookTarget[], handler: SoapHeaderObject | ((req: Request, payload: unknown) => Promise<SoapHeaderObject> | SoapHeaderObject)): void;
    /**
     * Register a hook that shapes the outbound SOAP payload for one or more
     * entities.
     *
     * The return value of `handler` replaces the payload that the
     * orchestrator would otherwise build from the CAP request.  Multiple
     * registrations for the same entity run in registration order; each
     * invocation receives the output of the previous stage.  The same
     * handler reference passed twice is de-duplicated.
     *
     * @param {HookTarget|HookTarget[]} targets - One or
     *   more entity references that this request transformer applies to.
     * @param {(req: Request, payload: *) => Promise<*>|*} handler - A
     *   function that receives the CAP request and the current payload, and
     *   returns the transformed payload (sync or async).
     * @throws {Error} If `handler` is not a function.
     * @returns {void}
     * @public
     */
    request(targets: HookTarget | HookTarget[], handler: (req: Request, payload: unknown) => Promise<unknown> | unknown): void;
    /**
     * Register a mock that fully replaces the SOAP round-trip for the given
     * entity/entities.
     *
     * When a mock is registered, the orchestrator returns the mock's value
     * directly instead of calling the SOAP backend.  Only **one** mock per
     * entity is kept — the last registration wins (unlike `request` /
     * `response` which accumulate).
     *
     * Intended for unit tests.  Not subject to error sanitisation — any
     * exception thrown by the mock is surfaced as-is to the caller.
     *
     * @param {HookTarget|HookTarget[]} targets - One or
     *   more entity references to mock.
     * @param {(req: Request, payload: *) => Promise<*>|*} handler - A
     *   function that receives the CAP request and the current payload, and
     *   returns the mock response (sync or async).
     * @throws {Error} If `handler` is not a function.
     * @returns {void}
     * @public
     */
    mock(targets: HookTarget | HookTarget[], handler: (req: Request, payload: unknown) => Promise<unknown>): void;
    /**
     * Register a hook that maps the raw SOAP response array into the flat
     * row shape that CAP expects for the target entity.
     *
     * Multiple registrations for the same entity run in registration order;
     * each invocation receives the output of the previous stage.  Unlike
     * `header` and `request`, this hook is **not** de-duplicated —
     * registering the same handler reference twice causes it to run twice.
     *
     * @param {HookTarget|HookTarget[]} targets - One or
     *   more entity references that this response mapper applies to.
     * @param {(req: Request, rows: object[]) => Promise<object[]>|object[]} handler
     *   - A function that receives the CAP request and the current row
     *   array, and returns the transformed row array (sync or async).
     * @throws {Error} If `handler` is not a function.
     * @returns {void}
     * @public
     */
    response(targets: HookTarget | HookTarget[], handler: (req: Request, rows: object[]) => Promise<object[]> | object[]): void;
}
/** Options accepted by {@link createRequest}. */
export interface CreateRequestOptions {
    /** CAP event name, e.g. `'READ'`. */
    event: string;
    /** CQN query object. */
    query: object;
    /** Request data / query parameters. */
    data?: object;
    /**
     * HTTP headers — shallow-cloned internally to avoid mutation of the
     * caller's object.
     */
    headers?: Record<string, string>;
    /** CDS entity definition assigned to `req.target`. */
    target?: object;
    /** By-key params array assigned to `req.params`. */
    params?: unknown[];
    /** `cds.User` instance assigned to `req.user`. */
    user?: object;
    /** Express `{ req, res }` pair assigned to `req.http`. */
    http?: {
        req: object;
        res: object;
    };
}
/**
 * Minimal shape of a CSN entity definition as seen at runtime.
 * The real type is `cds.linked.Entity` but that is not always available
 * in the type path; we use a structural subset here.
 */
export interface CsnEntityDefinition {
    keys?: Record<string, unknown>;
    elements?: Record<string, {
        key?: boolean;
        [k: string]: unknown;
    }>;
    [k: string]: unknown;
}
/**
 * Minimal structural shape of a CDS entity definition accepted by
 * {@link read} (for example `srv.entities.BusinessPartners`).
 */
export interface CdsEntityDef {
    name?: string;
    elements?: Record<string, unknown>;
    keys?: Record<string, unknown>;
    [key: string]: unknown;
}
/**
 * Minimal structural contract of a SOAP-backed CAP service that {@link read}
 * can dispatch against: its entity map and a `dispatch` method.
 */
export interface SoapService {
    entities: Record<string, CdsEntityDef>;
    dispatch(req: Request): Promise<unknown>;
}
/**
 * Optional overrides for {@link read}.
 */
export interface ReadOptions {
    /** Override headers entirely (still stripped before dispatch). */
    headers?: Record<string, unknown>;
    /** Override `inboundReq.params`. */
    params?: unknown[];
    /** Preferred source of HTTP headers when the inner tx request has lost them (e.g. inside `$expand` fan-out). */
    outerReq?: unknown;
    /** CSN entity definition used for key resolution when `srv.entities[entity]` is absent. */
    fallbackEntityDef?: CdsEntityDef;
}
/**
 * Creates a real `cds.Request` for SOAP dispatch, replacing any legacy
 * plain-object `simulatedTxReq` literal (Q-04 audit fix).
 *
 * Using a real `cds.Request` ensures:
 *   - `.error(code, msg)` accumulates errors via CAP semantics instead of
 *     throwing immediately.
 *   - All CAP middleware/pipeline hooks receive a properly typed request.
 *
 * @param opts - Options describing the request to create (single object
 *   argument). `event` and `query` are required; `data`, `headers`,
 *   `target`, `params`, `user` and `http` are optional.
 * @returns A fully initialised `cds.Request` with a unique context id.
 * @example
 * const req = soap.createRequest({
 *     event: 'READ',
 *     query: SELECT.from('ext.BusinessPartners'),
 *     headers: { 'accept-language': 'en' },
 *     user: inboundReq.user,
 * });
 * @public
 */
declare const createRequest: (opts: CreateRequestOptions) => Request;
/**
 * Resolve the flat list of key-field names for a CSN entity definition.
 *
 * Prefers `definition.keys` (present on all CAP-compiled entities, may be
 * empty) and falls back to scanning `definition.elements` for entries with
 * `key: true` (defensive path for exotic CSN shapes seen in projections
 * and unfolded queries).
 *
 * @param definition - CSN entity definition, e.g. `srv.entities.Foo`.
 * @returns Zero or more key-field names.
 * @public
 */
declare const getEntityKeyFields: (definition: CsnEntityDefinition | null | undefined) => string[];
/**
 * Deduplicate a flat row array by the given composite key fields.
 *
 * The first occurrence of each composite key wins. Rows with any `null` /
 * `undefined` key value are passed through as-is (missing keys cannot
 * establish identity, so dropping them would silently lose data). When
 * `keyFields` is empty, the input is returned unchanged.
 *
 * Uses `'||'` as the composite-key separator (matches the internal
 * convention).
 *
 * @param rows      - Array of plain objects (SOAP response rows).
 * @param keyFields - Field names to use as the composite key.
 * @returns Deduped rows in original order.
 * @public
 */
declare const dedupByKeys: (rows: unknown[], keyFields: string[]) => unknown[];
/**
 * Return `true` when the named service is configured as a SOAP service —
 * either `cds.requires[name].kind === 'soap'` or the CSN definition carries
 * the `@soap` annotation. Safe to call before `cds.services` is populated;
 * relies only on `cds.requires` and `cds.model.definitions`.
 *
 * Consumers that route a single request between REST/OData/SOAP siblings
 * need this check; it lived in every consumer's private helpers.
 *
 * @param serviceName - Fully-qualified or short CDS service name.
 * @returns `true` when the service is SOAP-backed, `false` otherwise.
 * @public
 */
declare const isSoapService: (serviceName: string) => boolean;
/**
 * One-shot SOAP read: assemble headers, build a real `cds.Request`, dispatch,
 * and deduplicate the result by entity key fields.
 *
 * @param {SoapService} srv - The SOAP service (`cds.services[<name>]`).
 * @param {string} entity - Key into `srv.entities`; used for key-field resolution and as the request target.
 * @param {Request} req - Inbound CAP request (source of user, params, headers).
 * @param {object} query - CQN SELECT query passed to `createRequest`.
 * @param {ReadOptions} [opts] - Optional overrides.
 * @returns {Promise<any[]>} Always an array; `[]` when dispatch returns nothing.
 */
declare const read: (srv: SoapService, entity: string, req: Request, query: unknown, opts?: ReadOptions) => Promise<unknown[]>;
export { Service, FORBIDDEN_SOAP_HEADERS, createRequest, getEntityKeyFields, dedupByKeys, isSoapService, read, };
//# sourceMappingURL=index.d.ts.map