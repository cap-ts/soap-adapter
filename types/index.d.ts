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
export type { ReadOptions } from './lib';
export { ApplicationService, createRequest, getEntityKeyFields, dedupByKeys, isSoapService, read, };
//# sourceMappingURL=index.d.ts.map