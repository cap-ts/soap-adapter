export = Base;
/**
 * @typedef {import('./Orchestrator').TraceContext} TraceContext
 * @typedef {import('./Orchestrator').CdsEntity} CdsEntity
 * @typedef {import('./Orchestrator').CdsRequest} CdsRequest
 * @typedef {import('./Orchestrator').SoapHeaderObject} SoapHeaderObject
 */
/**
 * Abstract foundational class defining structural contracts and lifecycle hook registration chains
 * for CAP-to-SOAP adapter overrides. This class cannot be instantiated directly.
 *
 * @abstract
 */
declare class Base {
    /**
     * Initializes the abstract service base layout.
     * @param {CdsEntity} entity - Contextual meta-reflection model representing the current execution entity instance.
     * @param {CdsRequest} req - The incoming runtime context parameter bundle payload managed by the active application framework.
     * @param {TraceContext} traceContext - Unique execution tracking identifier context map used for logging.
     * @throws {TypeError} If this abstract class is directly instantiated via `new Base()`.
     */
    constructor(entity: CdsEntity, req: CdsRequest, traceContext: TraceContext);
    entity: import("./Orchestrator").CdsEntity;
    req: import("./Orchestrator").CdsRequest;
    traceContext: import("./Orchestrator").TraceContext;
    _requestHandlers: {};
    _responseHandlers: {};
    _mockHandlers: {};
    _headerHandlers: {};
    /**
     * Abstract initialization sequence triggered automatically during instance generation.
     * Must be overridden in child classes to establish event listeners.
     * @abstract
     * @throws {Error} If the derived child class does not implement this method.
     * @returns {void}
     */
    init(): void;
    /**
     * Registers a custom SOAP header factory interceptor or a static structural payload value for a specific entity.
     * @param {string} entityName - Unqualified short name modifier string targeting an internal entity definition.
     * @param {SoapHeaderObject|function(*, CdsRequest): (Promise.<SoapHeaderObject>|SoapHeaderObject)} handler - A static header matching object configurations or an executable factory generator function.
     * @throws {Error} If the provided handler is neither a functional execution block nor an object structure.
     * @returns {void}
     */
    header(entityName: string, handler: SoapHeaderObject | ((arg0: any, arg1: CdsRequest) => (Promise<SoapHeaderObject> | SoapHeaderObject))): void;
    /**
     * Appends a pre-flight payload manipulation interceptor function to the execution chain of an entity.
     * @param {string} entityName - Unqualified short name modifier string targeting an internal entity definition.
     * @param {function(*, CdsRequest): (Promise.<*>|*)} handler - Callback function mutating incoming outbound arguments.
     * @throws {Error} If the handler input fails functional type evaluation checks.
     * @returns {void}
     */
    request(entityName: string, handler: (arg0: any, arg1: CdsRequest) => (Promise<any> | any)): void;
    /**
     * Registers a single intercept sandbox bypass mock handler function for an entity, overriding native network requests entirely.
     * @param {string} entityName - Unqualified short name modifier string targeting an internal entity definition.
     * @param {function(*, CdsRequest): (Promise.<*>|*)} handler - Intercept bypass simulation callback executing sandboxed returns.
     * @throws {Error} If the handler input fails functional type evaluation checks.
     * @returns {void}
     */
    mock(entityName: string, handler: (arg0: any, arg1: CdsRequest) => (Promise<any> | any)): void;
    /**
     * Appends a post-flight response extraction array mapping transformation interceptor function to the execution chain of an entity.
     * @param {string} entityName - Unqualified short name modifier string targeting an internal entity definition.
     * @param {function(*, CdsRequest): (Promise.<Array.<Object>>|Array.<Object>)} handler - Translation mapper formatting downstream runtime array structures.
     * @throws {Error} If the handler input fails functional type evaluation checks.
     * @returns {void}
     */
    response(entityName: string, handler: (arg0: any, arg1: CdsRequest) => (Promise<Array<any>> | Array<any>)): void;
}
declare namespace Base {
    export { TraceContext, CdsEntity, CdsRequest, SoapHeaderObject };
}
type TraceContext = import("./Orchestrator").TraceContext;
type CdsEntity = import("./Orchestrator").CdsEntity;
type CdsRequest = import("./Orchestrator").CdsRequest;
type SoapHeaderObject = import("./Orchestrator").SoapHeaderObject;
//# sourceMappingURL=Base.d.ts.map