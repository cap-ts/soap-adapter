export type TraceContext = {
    /**
     * - Unique execution tracking identifier used for log tracking.
     */
    correlationId: string;
    /**
     * - ID of the acting user or 'anonymous'.
     */
    user: string;
    /**
     * - ISO timestamp string indicating when the pipeline transaction initiated.
     */
    timestamp: string;
};
export type SoapBindingConfig = {
    /**
     * - The exact SOAP operation/method name exposed by the WSDL.
     */
    operation: string;
    /**
     * - Optional constructor reference for an adapter class handling lifecycle hook overrides.
     */
    resolvedAdapterClass?: Function;
    /**
     * - Overriding XML root element wrapper tag for outgoing payloads. Uses "none" to pass raw data.
     */
    rootRequest?: string;
    /**
     * - Explicit dot-notation pathway string indicating where the dataset payload array sits inside the incoming response.
     */
    rootResponse?: string;
};
/**
 * [@soap.path] - Explicit target data pathway mapping override to navigate the raw SOAP object graph.
 */
export type CdsEntityElement = {
    /**
     * - The primitive data type classification string (e.g., 'cds.String').
     */
    type?: string;
    ""?: string;
};
export type CdsEntity = {
    /**
     * - The fully qualified name string of the underlying domain model entity.
     */
    name: string;
    /**
     * - Key-value pair configuration maps of the entity fields.
     */
    elements: {
        [x: string]: CdsEntityElement;
    };
    "": SoapBindingConfig;
};
export type SoapHeaderObject = {
    /**
     * - The core body value or sub-graph assigned inside the soap header layer block.
     */
    value?: any;
    /**
     * - Target namespace tag name descriptor applied to XML tracking.
     */
    name?: string;
    /**
     * - Extracted XML prefix label binding node structure entries.
     */
    prefix?: string;
    /**
     * - Full target URI qualification schema address string.
     */
    xmlns?: string;
};
export type BaseAdapterInstance = {
    /**
     * - Registered request mutation callback stacks.
     */
    _requestHandlers: {
        [x: string]: ((arg0: any, arg1: cds.Request) => (Promise<any> | any))[];
    };
    /**
     * - Sandbox mock boundary intercept hooks.
     */
    _mockHandlers: {
        [x: string]: (arg0: any, arg1: cds.Request) => (Promise<any> | any);
    };
    /**
     * - Custom explicit security header factory injectors.
     */
    _headerHandlers: {
        [x: string]: (SoapHeaderObject | ((arg0: any, arg1: cds.Request) => (Promise<SoapHeaderObject> | SoapHeaderObject)))[];
    };
    /**
     * - Dynamic override translation format steps.
     */
    _responseHandlers: {
        [x: string]: ((arg0: any, arg1: cds.Request) => (Promise<Array<any>> | Array<any>))[];
    };
};
/**
 * @typedef {Object} TraceContext
 * @property {string} correlationId - Unique execution tracking identifier used for log tracking.
 * @property {string} user - ID of the acting user or 'anonymous'.
 * @property {string} timestamp - ISO timestamp string indicating when the pipeline transaction initiated.
 */
/**
 * @typedef {Object} SoapBindingConfig
 * @property {string} operation - The exact SOAP operation/method name exposed by the WSDL.
 * @property {Function} [resolvedAdapterClass] - Optional constructor reference for an adapter class handling lifecycle hook overrides.
 * @property {string} [rootRequest] - Overriding XML root element wrapper tag for outgoing payloads. Uses "none" to pass raw data.
 * @property {string} [rootResponse] - Explicit dot-notation pathway string indicating where the dataset payload array sits inside the incoming response.
 */
/**
 * @typedef {Object} CdsEntityElement
 * @property {string} [type] - The primitive data type classification string (e.g., 'cds.String').
 * @property {string} [@soap.path] - Explicit target data pathway mapping override to navigate the raw SOAP object graph.
 */
/**
 * @typedef {Object} CdsEntity
 * @property {string} name - The fully qualified name string of the underlying domain model entity.
 * @property {Object.<string, CdsEntityElement>} elements - Key-value pair configuration maps of the entity fields.
 * @property {SoapBindingConfig} @soap.binding - Embedded annotations directive containing runtime transport instructions.
 * @property {Object} parent - Positional contextual parent registry handle.
 * @property {string} parent.name - The explicit namespace identifier of the parent service.
 */
/**
 * @typedef {Object} SoapHeaderObject
 * @property {*} [value] - The core body value or sub-graph assigned inside the soap header layer block.
 * @property {string} [name] - Target namespace tag name descriptor applied to XML tracking.
 * @property {string} [prefix] - Extracted XML prefix label binding node structure entries.
 * @property {string} [xmlns] - Full target URI qualification schema address string.
 */
/**
 * @typedef {Object} BaseAdapterInstance
 * @property {Object.<string, Array<function(*, cds.Request): (Promise.<*>|*)>>} _requestHandlers - Registered request mutation callback stacks.
 * @property {Object.<string, function(*, cds.Request): (Promise.<*>|*)>} _mockHandlers - Sandbox mock boundary intercept hooks.
 * @property {Object.<string, Array<(SoapHeaderObject|function(*, cds.Request): (Promise.<SoapHeaderObject>|SoapHeaderObject))>>} _headerHandlers - Custom explicit security header factory injectors.
 * @property {Object.<string, Array<function(*, cds.Request): (Promise.<Array.<Object>>|Array.<Object>)>>} _responseHandlers - Dynamic override translation format steps.
 */
/**
 * Orchestrates CAP-to-SOAP middleware pipelines by managing boot-time target file system validations,
 * dynamically fetching soap client proxies, executing lifecycle event hooks, parsing path lookups,
 * and converting structural nested objects into planar array datasets.
 */
export class Orchestrator {
    /**
     * Reusable utility to normalize the WSDL path string by handling relative normalization
     * and hardcoding the suffix fallback extension if the user left it off.
     * @param {string} [configuredPath] - The raw path configuration string to evaluate.
     * @returns {string} The finalized absolute file system path, or an empty string if input evaluates to falsy.
     * @static
     */
    static resolveWsdlPath(configuredPath?: string): string;
    /**
     * Traverses a deeply nested complex object structure down an explicit dot-notation path, resolving unwrapped
     * `$value` fields or underlying item collection arrays where necessary.
     * @param {*} obj - The base root object graph to traverse.
     * @param {string} [pathStr] - A dot-separated string path mapping out destination elements (e.g., 'Result.Data.Record').
     * @returns {*} Evaluated value at target path, unnested item collection arrays, or `undefined` if parsing falls flat.
     * @static
     */
    static getNestedValue(obj: any, pathStr?: string): any;
    /**
     * Fail-Fast Integrity Guard running checks on application boot sequence.
     * Iterates over framework environment requirements on initialization to enforce fail-fast application boot structural safety.
     * @throws {Error} If a configured SOAP service lacks a specified tracking path or the target storage asset is physically missing.
     * @returns {void}
     */
    validateProjectConfigurations(): void;
    /**
     * Executes the lifecycle pipeline tracking processing workflow loop for intercepted interface interactions.
     * Handles payload pre-processing, automatic XML root generation packaging, header injection, live network communication or mocking,
     * and recursive flattening conversions into mapping models.
     * @param {cds.Request} req - The incoming runtime context parameter bundle payload managed by the active application framework.
     * @returns {Promise<Array<Object>|void>} Resolves with a flat array mapping extracted data elements, or undefined if configuration conditions break early.
     * @async
     */
    handleEvent(req: cds.Request): Promise<Array<any> | void>;
}
//# sourceMappingURL=index.d.ts.map