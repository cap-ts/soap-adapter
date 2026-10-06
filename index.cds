annotation Soap : Boolean default true;

/**
 * Binds an entity to a concrete SOAP operation.
 *
 * `rootRequest` — documents the operation's input element. Not used at runtime:
 * node-soap builds the envelope from the WSDL, and the `request()` hook's
 * return value is the input message.
 * `rootResponse` — dot path of the SOAP response element whose contents are
 * the CAP rows. Optional; `@Soap.rootResponse` takes precedence, and without
 * either `<operation>Response` is used.
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
 * Dot path of the SOAP response element to unwrap. Takes precedence over
 * `@Soap.binding.rootResponse`.
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
 * `multipleSelection` — set it to `false` when the operation takes one key
 * value per call: `<first key> in (a, b, c)` is then sent as one SOAP call
 * per value (batches of `cds.env.soap.multiSelectionConcurrency`) and the
 * results merged; a second `in` on the key or `in` with `or` is a 400.
 * `true` or unset: the `request()` hook receives the `in (...)` as is.
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
