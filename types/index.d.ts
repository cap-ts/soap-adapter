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
    ApplicationService: typeof ApplicationService;
    FORBIDDEN_SOAP_HEADERS: typeof ApplicationService.FORBIDDEN_SOAP_HEADERS;
    createRequest: typeof createRequest;
    getEntityKeyFields: typeof getEntityKeyFields;
    dedupByKeys: typeof dedupByKeys;
    isSoapService: typeof isSoapService;
    read: typeof read;
};
export type { ReadOptions } from './lib';
export { soap };
//# sourceMappingURL=index.d.ts.map