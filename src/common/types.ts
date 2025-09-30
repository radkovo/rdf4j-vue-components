/**
 * Basic RDF context description.
 */
export interface ContextDescription {
    iri: string;
}

/**
 * A single binding for a variable in a SPARQL query result.
 */
export type RdfValueBinding = { [key: string]: RdfValueSpec };

/**
 * RDF4J SELECT query result.
 */
export interface SelectQueryResult {
    head: {
        vars: string[];
    }
    results: {
        bindings: RdfValueBinding[];
    }
}

export interface AskQueryResult {
    head?: { };
    boolean: boolean;
}

export interface UpdateQueryResult {
    success: boolean;
}

/**
 * A RDF value returned by the RDF4J API.
 */
export interface RdfValueSpec {
    datatype?: string;
    type: string;
    value: string;
}

/**
 * Repository information returned by the RDF4J API.
 */
export interface RepositoryInfo {
    id: string;
    title: string;
}

/**
 * A saved query.
 */
export interface SavedQuery {
    id?: number;
    title: string;
    queryString: string;
}

/**
 * A namespace definition.
 */
export interface NamespaceDef {
    prefix: string;
    namespace: string;
}

/**
 * A query result provided by the RDF editor when the query is executed.
 */
export type QueryResult =
    | {
        total: number;
        type: "select";
        prefixes: NamespaceDef[];
        data: SelectQueryResult;
    }
    | {
        total: number;
        type: "ask";
        prefixes: NamespaceDef[];
        data: AskQueryResult;
    }
    | {
        total: number;
        type: "update";
        prefixes: NamespaceDef[];
        data: UpdateQueryResult;
    }
    | {
        total: number;
        type: "construct";
        prefixes: NamespaceDef[];
        data: string; // RDF or other serialized graph format
    }
    | {
        type: "clear";
    }

/**
 * A value to be displayed by RdfValue components. A RDF value with optional predicate and subject that can
 * be used for presenting the value in a specific way.
 */
export interface DisplayValue {
    v: RdfValueSpec;  // the value itself
    p?: RdfValueSpec; // optional predicate
    s?: RdfValueSpec; // optional subject
}
