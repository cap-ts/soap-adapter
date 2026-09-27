annotation Soap : Boolean default true;

/**
 * Binds an entity to a concrete SOAP operation.
 *
 * `rootRequest` — the SOAP request element name to wrap the outbound payload in.
 * `rootResponse` — the SOAP response element name whose contents are extracted
 * as the CAP result. Optional; when omitted the loader falls back to the
 * entity's `@Soap.rootResponse` scalar (if set) or to a heuristic based
 * on the operation name.
 */
annotation Soap.binding {
    rootRequest  : String;
    rootResponse : String;
}

/**
 * WSDL operation name that services SELECT / READ requests for this entity.
 * Populates `@Soap.binding.operation` in the CSN at load time so
 * downstream code can uniformly read the operation from the binding struct.
 */
annotation Soap.operation : String;

/**
 * SOAP response element name to unwrap. Only used when
 * `@Soap.binding.rootResponse` is not set.
 */
annotation Soap.rootResponse : String;

/**
 * Explicit dot-path override applied when the orchestrator walks a raw
 * SOAP response tree to locate the payload for this entity or element.
 * Overrides the loader's structural inference.
 */
annotation Soap.path : String;

/**
 * Per-entity filter policy enforced by the runtime before dispatch.
 *
 * `mandatoryFields` — property names that MUST appear in `$filter` for the
 * request to be accepted; missing fields raise a 400 with a diagnostic
 * that names the field.
 * `multipleSelection` — when `false`, `$filter` on any mandatory field
 * must be a single equality clause; `in(…)` / `or` / `ne` combinations
 * are rejected.
 */
annotation Soap.filterRestriction {
    mandatoryFields   : array of String;
    multipleSelection : Boolean;
};

/**
 * npm specifier of the adapter module that implements the request /
 * response / mock / header hooks for this service or entity. Resolved via
 * `require.resolve(spec, { paths: [cds.root] })` — unblocks monorepo reuse
 * (adapter class shipped from a sibling package) and works with pre-
 * compiled CSN where `$location.file` is unavailable. When set on both an
 * entity and its parent service, the entity-level value wins. When
 * unset, the loader falls back to the filesystem convention
 * `<cds-dir>/lib/<ServiceShortName>.{ts,js}`.
 */
annotation Soap.adapter : String;
