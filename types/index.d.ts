/**
 * @module @cap-ts/soap-adapter
 * @description
 * Public entry point for `@cap-ts/soap-adapter`.
 *
 * Exposes the `soap` namespace containing the public API surface:
 *
 * | Symbol | Description |
 * |--------|-------------|
 * | `Service` | Base class of a SOAP service: the CAP service class every adapter extends. |
 * | `FORBIDDEN_SOAP_HEADERS` | Frozen list of header names stripped from outbound SOAP requests. |
 * | `createRequest` | Factory for constructing CAP `cds.Request`-compatible objects. |
 * | `getEntityKeyFields` | Extracts the key field names from a CSN entity definition. |
 * | `dedupByKeys` | Deduplicates a record array by a composite key. |
 * | `isSoapService` | Predicate — returns `true` when a CDS service is SOAP-bound. |
 * | `read` | Convenience wrapper for issuing a READ against a SOAP service. |
 *
 * @example
 * ```ts
 * // Adapter class, e.g. srv/external/lib/BusinessPartner.js:
 * const { soap } = require('@cap-ts/soap-adapter');
 * module.exports = class BusinessPartner extends soap.Service {
 *     async init() { this.request(...); await super.init(); }
 * };
 * ```
 */
/**
 * The single public namespace of `@cap-ts/soap-adapter`.
 *
 * Every runtime value and every type this package exposes lives here:
 * `soap.Service`, `soap.FORBIDDEN_SOAP_HEADERS`, `soap.createRequest`,
 * `soap.getEntityKeyFields`, `soap.dedupByKeys`, `soap.isSoapService`, `soap.read`,
 * and the types they use (`soap.ReadOptions`, `soap.CdsEntity`,
 * `soap.SoapHeaderObject`, `soap.CreateRequestOptions`, ...).
 *
 * @example
 * ```ts
 * import { soap } from '@cap-ts/soap-adapter';
 * class BP extends soap.Service { async init() { ...; await super.init(); } }
 * ```
 */
export * as soap from './lib';
//# sourceMappingURL=index.d.ts.map