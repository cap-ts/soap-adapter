/**
 * @module @cap-ts/soap-adapter/lib
 * @description Public API surface of the `@cap-ts/soap-adapter` library.
 *
 * Exports {@link ApplicationService} — the abstract base class that every
 * per-entity SOAP adapter must extend — along with {@link FORBIDDEN_SOAP_HEADERS}
 * and a set of re-exported utilities (`createRequest`, `getEntityKeyFields`,
 * `dedupByKeys`, `isSoapService`, `read`).
 *
 * The loader (`_loader/index`) discovers subclasses by filename convention,
 * instantiates them per request, and drives them via the orchestrator
 * (`_orchestrator/index`).
 *
 * @see {@link ApplicationService}
 * @see {@link FORBIDDEN_SOAP_HEADERS}
 */
import type { Request } from '@sap/cds';
/**
 * Correlation / tracing identifiers forwarded to every hook invocation so
 * that adapter code can emit structured log lines without having to
 * reconstruct the context from the raw CAP request.
 *
 * @interface TraceContext
 * @property {string} correlationId - Platform-level correlation ID (e.g.
 *   `x-vcap-request-id` or `x-correlation-id` from the inbound request).
 * @property {string} user - The authenticated user identifier, typically
 *   `req.user.id` as resolved by CAP's authentication middleware.
 * @property {string} timestamp - ISO-8601 timestamp captured at the start
 *   of the request, used for log ordering and latency calculations.
 */
interface TraceContext {
    correlationId: string;
    user: string;
    timestamp: string;
}
/**
 * Minimal shape of a CAP CSN entity reflection object as seen at runtime.
 * The full `cds.linked` entity carries many more fields; only the subset
 * consumed by the adapter framework is declared here.
 *
 * @interface CdsEntity
 * @property {string} name - Fully qualified entity name, e.g.
 *   `'ext.BusinessPartnerSet'`.
 * @property {Record<string, CdsEntityElement>} elements - Map of element
 *   (field) name → element descriptor.
 * @property {SoapBindingConfig} [@Soap.binding] - Optional SOAP binding
 *   annotation placed on the entity in the `.cds` model.
 * @property {{ name: string }} parent - The parent service or namespace
 *   object; `parent.name` is used to look up `cds.services[parentName]`.
 */
interface CdsEntity {
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
interface CdsEntityElement {
    type?: string;
    '@Soap.path'?: string;
    [key: string]: unknown;
}
/**
 * Value of the `@Soap.binding` annotation on a CDS entity.  Populated by
 * the loader after it resolves the adapter class.
 *
 * @interface SoapBindingConfig
 * @property {string} operation - SOAP operation name (WSDL `<operation>`),
 *   e.g. `'GetBusinessPartnerCollection'`.
 * @property {new (entity: CdsEntity, req: Request, trace: TraceContext) => BaseAdapterInstance} [resolvedAdapterClass]
 *   - The adapter subclass constructor resolved by the loader.  Absent until
 *   the loader has completed its discovery pass.
 * @property {string} [rootRequest] - Optional XPath root element to wrap
 *   the outbound SOAP request payload in.
 * @property {string} [rootResponse] - Optional XPath root element to unwrap
 *   from the inbound SOAP response before mapping.
 */
interface SoapBindingConfig {
    operation: string;
    resolvedAdapterClass?: new (entity: CdsEntity, req: Request, trace: TraceContext) => BaseAdapterInstance;
    rootRequest?: string;
    rootResponse?: string;
}
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
interface SoapHeaderObject {
    value?: unknown;
    name?: string;
    prefix?: string;
    xmlns?: string;
    [key: string]: unknown;
}
/**
 * Minimal structural contract that every `ApplicationService` instance must
 * satisfy so the orchestrator can dispatch hooks without knowing the
 * concrete subclass.
 *
 * @interface BaseAdapterInstance
 * @property {Record<string, Array<Function>>} _requestHandlers - Per-entity
 *   ordered list of outbound payload transformers registered via
 *   {@link ApplicationService#request}.
 * @property {Record<string, Function>} _mockHandlers - Per-entity mock
 *   replacements registered via {@link ApplicationService#mock}.  Only one
 *   mock per entity; the last registration wins.
 * @property {Record<string, Array<SoapHeaderObject|Function>>} _headerHandlers
 *   - Per-entity header providers registered via {@link ApplicationService#header}.
 * @property {Record<string, Array<Function>>} _responseHandlers - Per-entity
 *   ordered list of response mappers registered via
 *   {@link ApplicationService#response}.
 */
interface BaseAdapterInstance {
    _requestHandlers: Record<string, Array<(payload: unknown, req: Request) => Promise<unknown> | unknown>>;
    _mockHandlers: Record<string, (req: Request, payload: unknown) => Promise<unknown>>;
    _headerHandlers: Record<string, Array<SoapHeaderObject | ((req: Request, payload: unknown) => Promise<SoapHeaderObject> | SoapHeaderObject)>>;
    _responseHandlers: Record<string, Array<(rows: object[], req: Request) => Promise<object[]> | object[]>>;
}
/**
 * Abstract base class for per-entity SOAP adapters.
 *
 * Consumers subclass this, override {@link ApplicationService#init} to
 * register any combination of {@link ApplicationService#header},
 * {@link ApplicationService#request}, {@link ApplicationService#mock}, and
 * {@link ApplicationService#response} hooks, then export the subclass from a
 * file named `<EntityShortName>.js` or `<EntityShortName>.ts` placed next to
 * the service's `.cds` file.
 *
 * **Contract:**
 * - **One instance per request.** Do not cache request-scoped state on
 *   `this` across requests.  `entity`, `req`, and `traceContext` are
 *   populated fresh for every invocation.
 * - **`init()` is called once, from the constructor**, after the request
 *   fields are populated.  Register all hooks there.
 * - **Hooks are dispatched by unqualified entity short-name** (e.g.
 *   `'BusinessPartner'`, not `'ext.BusinessPartner'`).  The `targets`
 *   parameter of each registration method accepts strings, CSN entity
 *   objects, arrays of either, or comma-separated strings.
 *
 * @abstract
 * @example
 * // Minimal adapter for a "ProductSet" entity:
 * class ProductSet extends ApplicationService {
 *     init() {
 *         this.request('ProductSet', async (req) => ({
 *             ProductID: req.data.ID,
 *         }));
 *         this.response('ProductSet', (req, rows) =>
 *             rows.map(r => ({ ...r, _source: 'soap' }))
 *         );
 *     }
 * }
 * module.exports = { ProductSet };
 */
declare class ApplicationService {
    /**
     * Frozen array of HTTP header names that must never be forwarded to a
     * SOAP backend.  Used by {@link ApplicationService.stripSensitiveHeaders}.
     * @static
     * @readonly
     * @public
     */
    static readonly FORBIDDEN_SOAP_HEADERS: readonly string[];
    /**
     * CSN entity reflection object for the entity this adapter instance
     * serves.  Populated by the constructor before `init()` is called.
     * @public
     */
    entity: CdsEntity;
    /**
     * The current CAP request.  Available as `this.req` inside all hooks.
     * @public
     */
    req: Request;
    /**
     * Correlation / tracing identifiers forwarded from the orchestrator.
     * Forwarded to every hook invocation for structured logging.
     * @public
     */
    traceContext: TraceContext;
    /**
     * All entities exposed by the parent CAP service, keyed by unqualified
     * short-name.  Populated automatically from `cds.services[parentName].entities`
     * in the constructor.  Empty object `{}` when the parent service cannot
     * be resolved (e.g. in unit tests that do not boot a full CAP server).
     * @public
     */
    entities: Record<string, CdsEntity>;
    /**
     * Per-entity ordered list of outbound payload transformer functions
     * registered via {@link ApplicationService#request}.
     * @protected
     */
    protected _requestHandlers: Record<string, Array<(payload: unknown, req: Request) => Promise<unknown> | unknown>>;
    /**
     * Per-entity ordered list of response mapper functions registered via
     * {@link ApplicationService#response}.
     * @protected
     */
    protected _responseHandlers: Record<string, Array<(rows: object[], req: Request) => Promise<object[]> | object[]>>;
    /**
     * Per-entity mock replacement functions registered via
     * {@link ApplicationService#mock}.  Only one mock per entity; the last
     * registration wins.
     * @protected
     */
    protected _mockHandlers: Record<string, (req: Request, payload: unknown) => Promise<unknown>>;
    /**
     * Per-entity header providers (static objects or evaluator functions)
     * registered via {@link ApplicationService#header}.
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
     * The allowlist is exposed as `ApplicationService.FORBIDDEN_SOAP_HEADERS`
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
     *     ApplicationService.stripSensitiveHeaders(req.headers ?? {})
     * );
     * @static
     * @public
     */
    static stripSensitiveHeaders(headers: Record<string, unknown>): Record<string, unknown>;
    /**
     * Initialise the adapter instance for a single CAP request.
     *
     * Performs the following steps in order:
     * 1. Guards against direct instantiation (abstract-class enforcement).
     * 2. Stores `entity`, `req`, and `traceContext` on `this`.
     * 3. Initialises the four empty handler registries
     *    (`_requestHandlers`, `_responseHandlers`, `_mockHandlers`,
     *    `_headerHandlers`).
     * 4. Resolves the parent service name from the entity reflection and
     *    binds `this.entities` from `cds.services[parentName].entities`.
     * 5. Calls `_superInit()` (framework extension point, currently a no-op).
     * 6. Calls `init()` so the subclass can register its hooks.
     *
     * @param {CdsEntity} entity - CSN entity reflection for the entity this
     *   adapter serves (e.g. `srv.entities.BusinessUserSet`).
     * @param {Request} req - The current CAP request.  Available as
     *   `this.req` inside all hook callbacks.
     * @param {TraceContext} traceContext - Correlation IDs for structured
     *   logs; forwarded to every hook invocation.
     * @throws {TypeError} If instantiated directly (i.e. `new.target ===
     *   ApplicationService`) instead of via a concrete subclass.
     * @public
     */
    constructor(entity: CdsEntity, req: Request, traceContext: TraceContext);
    /**
     * Framework extension point called by the constructor immediately before
     * {@link ApplicationService#init}.  Currently a no-op; reserved for
     * future default initialisation steps (e.g. injecting framework-level
     * hooks or populating shared metadata).
     *
     * Subclasses **may** call `super._superInit()` from their own `init()`
     * for forward-compatibility, but nothing depends on it today.
     *
     * Visibility is `protected` (not `private`) because the documented
     * override contract via `super._superInit()` requires subclass access.
     *
     * @returns {void}
     * @protected
     */
    protected _superInit(): void;
    /**
     * Lifecycle hook called once from the constructor after all instance
     * fields are populated.  Subclasses **must** override this method and
     * use it to register their SOAP hooks via `header()`, `request()`,
     * `mock()`, and/or `response()`.
     *
     * The base implementation throws unconditionally so that a missing
     * override is caught at instantiation time rather than silently
     * producing a no-op adapter.
     *
     * @abstract
     * @throws {Error} Always — subclasses must override this method.
     * @returns {void}
     * @public
     */
    init(): void;
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
     * @param {string|CdsEntity|Array<string|CdsEntity>|null|undefined} targets
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
     * {@link ApplicationService.stripSensitiveHeaders}.
     *
     * @param {string|CdsEntity|Array<string|CdsEntity>} targets - One or
     *   more entity references that this header provider applies to.
     * @param {SoapHeaderObject|((req: Request, payload: *) => Promise<SoapHeaderObject>|SoapHeaderObject)} handler
     *   - Static header object or evaluator function.
     * @throws {Error} If `handler` is neither a function nor an object.
     * @returns {void}
     * @public
     */
    header(targets: string | CdsEntity | Array<string | CdsEntity>, handler: SoapHeaderObject | ((req: Request, payload: unknown) => Promise<SoapHeaderObject> | SoapHeaderObject)): void;
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
     * @param {string|CdsEntity|Array<string|CdsEntity>} targets - One or
     *   more entity references that this request transformer applies to.
     * @param {(payload: *, req: Request) => Promise<*>|*} handler - A
     *   function that receives the current payload and the CAP request, and
     *   returns the transformed payload (sync or async).
     * @throws {Error} If `handler` is not a function.
     * @returns {void}
     * @public
     */
    request(targets: string | CdsEntity | Array<string | CdsEntity>, handler: (payload: unknown, req: Request) => Promise<unknown> | unknown): void;
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
     * @param {string|CdsEntity|Array<string|CdsEntity>} targets - One or
     *   more entity references to mock.
     * @param {(req: Request, payload: *) => Promise<*>|*} handler - A
     *   function that receives the CAP request and the current payload, and
     *   returns the mock response (sync or async).
     * @throws {Error} If `handler` is not a function.
     * @returns {void}
     * @public
     */
    mock(targets: string | CdsEntity | Array<string | CdsEntity>, handler: (req: Request, payload: unknown) => Promise<unknown>): void;
    /**
     * Register a hook that maps the raw SOAP response array into the flat
     * row shape that CAP expects for the target entity.
     *
     * Multiple registrations for the same entity run in registration order;
     * each invocation receives the output of the previous stage.  Unlike
     * `header` and `request`, this hook is **not** de-duplicated —
     * registering the same handler reference twice causes it to run twice.
     *
     * @param {string|CdsEntity|Array<string|CdsEntity>} targets - One or
     *   more entity references that this response mapper applies to.
     * @param {(rows: object[], req: Request) => Promise<object[]>|object[]} handler
     *   - A function that receives the current row array and the CAP
     *   request, and returns the transformed row array (sync or async).
     * @throws {Error} If `handler` is not a function.
     * @returns {void}
     * @public
     */
    response(targets: string | CdsEntity | Array<string | CdsEntity>, handler: (rows: object[], req: Request) => Promise<object[]> | object[]): void;
}
declare const createRequest: typeof import("./_request").createRequest;
declare const getEntityKeyFields: typeof import("./_util/entity").getEntityKeyFields, dedupByKeys: typeof import("./_util/entity").dedupByKeys, isSoapService: typeof import("./_util/entity").isSoapService;
declare const read: typeof import("./_read").read;
export type { ReadOptions } from './_read';
export { ApplicationService, createRequest, getEntityKeyFields, dedupByKeys, isSoapService, read, };
//# sourceMappingURL=index.d.ts.map