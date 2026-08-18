export = ApplicationService;
/**
 * @typedef {import('./_orchestrator').TraceContext} TraceContext
 * @typedef {import('./_orchestrator').CdsEntity} CdsEntity
 * @typedef {import('./_orchestrator').SoapHeaderObject} SoapHeaderObject
 */
/**
 * Abstract foundational class defining structural contracts and lifecycle hook registration chains
 * for CAP-to-SOAP adapter overrides. This class cannot be instantiated directly.
 *
 * @abstract
 */
declare class ApplicationService {
    /**
     * Initializes the abstract service base layout.
     * @param {CdsEntity} entity - Contextual meta-reflection model representing the current execution entity instance.
     * @param {cds.Request} req - The incoming runtime context parameter bundle payload managed by the active application framework.
     * @param {TraceContext} traceContext - Unique execution tracking identifier context map used for logging.
     * @throws {TypeError} If this abstract class is directly instantiated via `new ApplicationService()`.
     */
    constructor(entity: CdsEntity, req: cds.Request, traceContext: TraceContext);
    entity: any;
    req: cds.Request;
    traceContext: any;
    _requestHandlers: {};
    _responseHandlers: {};
    _mockHandlers: {};
    _headerHandlers: {};
    entities: any;
    /**
     * Internal framework initialization lifecycle wrapper.
     * Safe fallback that child classes can call via super._superInit() if wanted.
     * @private
     */
    private _superInit;
    /**
     * Abstract initialization sequence triggered automatically during instance generation.
     * Must be overridden in child classes to establish event listeners.
     * @abstract
     * @throws {Error} If the derived child class does not implement this method.
     * @returns {void}
     */
    init(): void;
    /**
     * Internal framework utility to convert single or multi-target inputs down
     * to a flat list of clean, unqualified short name string token keys.
     * Fully handles: Arrays of CSN Objects, single Objects, and raw strings.
     * @param {string|Object|Array.<string|Object>} targets - The input target(s) to normalize into a flat list of unqualified entity names.
     * @returns {Array.<string>} A flat list of unqualified entity name strings.
     * @private
     */
    private _resolveEntityNames;
    /**
     * @callback SoapHeaderEvaluator
     * @param {cds.Request} req - The incoming CAP request context.
     * @param {*} [data] - The optional secondary payload data context.
     * @returns {Promise.<SoapHeaderObject>|SoapHeaderObject}
     */
    /**
     * Registers a custom SOAP header factory interceptor or a static structural payload value for a specific entity.
     * @param {string|Object|Array.<string|Object>} targets - The input target(s) to normalize into a flat list of unqualified entity names.
     * @param {SoapHeaderObject|SoapHeaderEvaluator} handler - A static header matching object configurations or an executable factory generator function.
     * @throws {Error} If the provided handler is neither a functional execution block nor an object structure.
     * @returns {void}
     */
    header(targets: string | Object | Array<string | Object>, handler: SoapHeaderObject | ((req: cds.Request, data?: any) => Promise<SoapHeaderObject> | SoapHeaderObject)): void;
    /**
     * @callback SoapRequestEvaluator
     * @param {cds.Request} req - The incoming CAP request context.
     * @param {*} [data] - The optional secondary payload data context.
     * @returns {Promise.<*>|*}
     */
    /**
     * Appends a pre-flight payload manipulation interceptor function to the execution chain of an entity.
     * @param {string|Object|Array.<string|Object>} targets - The unqualified short name string or the compiled CSN Entity Object definition.
     * @param {SoapRequestEvaluator} handler - Callback function mutating incoming outbound arguments.
     * @throws {Error} If the handler input fails functional type evaluation checks.
     * @returns {void}
     */
    request(targets: string | Object | Array<string | Object>, handler: (req: cds.Request, data?: any) => Promise<any> | any): void;
    /**
     * @callback SoapMockEvaluator
     * @param {cds.Request} req - The incoming CAP request context.
     * @param {*} [data] - The optional secondary payload data context.
     * @returns {Promise.<*>|*}
     */
    /**
     * Registers a single intercept sandbox bypass mock handler function for an entity, overriding native network requests entirely.
     * @param {string|Object|Array.<string|Object>} targets - The input target(s) to normalize into a flat list of unqualified entity names.
     * @param {SoapMockEvaluator} handler - Intercept bypass simulation callback executing sandboxed returns.
     * @throws {Error} If the handler input fails functional type evaluation checks.
     * @returns {void}
     */
    mock(targets: string | Object | Array<string | Object>, handler: (req: cds.Request, data?: any) => Promise<any> | any): void;
    /**
    * @callback SoapResponseEvaluator
    * @param {cds.Request} req - The incoming CAP request context.
    * @param {any[]} data - The response data context.
    * @returns {Promise.<Array.<Object>>|Array.<Object>}
    */
    /**
     * Appends a post-flight response extraction array mapping transformation interceptor function to the execution chain of an entity.
     * @param {string|Object|Array.<string|Object>} targets - The unqualified short name string or the compiled CSN Entity Object definition.
     * @param {SoapResponseEvaluator} handler - Translation mapper formatting downstream runtime array structures.
     * @throws {Error} If the handler input fails functional type evaluation checks.
     * @returns {void}
     */
    response(targets: string | Object | Array<string | Object>, handler: (req: cds.Request, data: any[]) => Promise<Array<Object>> | Array<Object>): void;
}
declare namespace ApplicationService {
    export { TraceContext, CdsEntity, SoapHeaderObject };
}
type TraceContext = any;
type CdsEntity = any;
type SoapHeaderObject = any;
//# sourceMappingURL=index.d.ts.map