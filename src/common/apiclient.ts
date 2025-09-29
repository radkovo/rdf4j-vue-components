const develMode = (window.location.port === '3000'); //development server detection
const localMode = (window.location.hostname === 'localhost'); //local mode (http allowed)
const protocol = localMode ? location.protocol : 'https:'; //force https for non-local mode
//const flhost = develMode ? 'http://localhost:8080' : (protocol + '//' + window.location.host);

// SELECT response size limit (in rows) sent to the endpoint. 
// Note that the server also has a maximal allowed limit that cannot be exceeded.
const QUERY_LIMIT = 2048; 

// Local storage key for saved queries.
const QUERIES_STORAGE_KEY = 'rdf4j-queries';

// RDF4J NIL IRI
const NIL_IRI = 'http://rdf4j.org/schema/rdf4j#nil';

import IriDecoder from './iridecoder.js';

export interface ApiClient {
    serverUrl: string;
    currentRepo: string;
    onNotAuthorized: (() => void) | null;

    setServerUrl(url: string): void;
    setRepository(repo: string): Promise<void>;
    login(username: string | null, password: string | null): Promise<void>;
    getSubjectDescription(iri: string): Promise<SelectQueryResult>;
    getSubjectReferences(iri: string): Promise<SelectQueryResult>;
    getSubjectMentions(iri: string): Promise<SelectQueryResult>;
    getSubjectValue(subjectIri: string, propertyIri: string): Promise<RdfValue>;
    selectQuery(query: string, limit?: number): Promise<SelectQueryResult>;
    askQuery(query: string, limit?: number): Promise<AskQueryResult>;
    constructQuery(query: string, accept: string, limit?: number): Promise<string>;
    updateQuery(query: string): Promise<UpdateQueryResult>;
    getContexts(): Promise<ContextDescription[]>;
    exportContext(contextIri: string, mime: string, thenFunction: (blob: Blob) => void): void;
    replaceContext(contextIri: string, mime: string, data: string): Promise<void>;
    deleteContext(contextIri: string): Promise<boolean>;
    listRepositories(): Promise<RepositoryInfo[]>;
    getNamespaces(): Promise<SelectQueryResult>;
    getIriDecoder(): Promise<IriDecoder>;
    getSavedQueries(): Promise<SavedQuery[]>;
    saveQuery(data: SavedQuery): Promise<void>;
    deleteQuery(queryId: number): Promise<void>;
    toObject(binding: RdfValueBinding): object;
    toObjectArray(bindings: RdfValueBinding[]): object[];
}

import type { AskQueryResult, ContextDescription, RdfValue, RdfValueBinding, RepositoryInfo, SavedQuery, SelectQueryResult, UpdateQueryResult } from './types.js';
import { errMsg } from './utils.js';

/**
 * A default API client implementation that uses fetch() for connecting the RDF4J server REST API.
 * Saved queries are stored in local storage.
 */
export class DefaultApiClient implements ApiClient {

	serverUrl: string = 'http://localhost/rdf4j-server';
	serverLogin: string | null = null;
	serverPassword: string | null = null;

	currentRepo: string = 'default';
	onNotAuthorized: (() => void) | null = null;

	cachedNamespaces: SelectQueryResult | null = null;
	iriDecoder: IriDecoder | null = null;

	constructor() {
	}

	repositoryEndpoint(): string {
		return this.serverUrl + '/repositories/' + this.currentRepo;
	}

	setServerUrl(url: string): void {
		this.serverUrl = url;
    }

	async setRepository(repo: string): Promise<void> {
		this.currentRepo = repo;
		this.cachedNamespaces = null;
		this.iriDecoder = null;
		await this.getIriDecoder(); // update IriDecoder with current namespaces
	}

	/**
	 * Sets the server login and password for authentication of the requests.
	 * @param username The username for authentication. If null, authentication is disabled.
	 * @param password The password for authentication. If null, authentication is disabled.
	 */
	async login(username: string | null, password: string | null): Promise<void> {
		this.serverLogin = username;
		this.serverPassword = password;
		this.iriDecoder = null;
		await this.getIriDecoder(); // update IriDecoder with current namespaces
	}

    async getSubjectDescription(iri: string): Promise<SelectQueryResult> {
		const query = `
			SELECT (?s as ?subject) (?p as ?predicate) (?o as ?object) (?g as ?context) WHERE {
				{
					GRAPH <${NIL_IRI}> {
						<${iri}> ?p ?o .
						BIND(<${iri}> AS ?s)
					}
				}
				UNION
				{
					GRAPH ?g {
						<${iri}> ?p ?o .
						BIND(<${iri}> AS ?s)
					}
				}
			}		
		`;
		return await this.selectQuery(query);
	}

    async getSubjectReferences(iri: string): Promise<SelectQueryResult> {
		const query = `
			SELECT (?s as ?subject) (?p as ?predicate) (?o as ?object) (?g as ?context) WHERE {
				{
					GRAPH <${NIL_IRI}> {
						?s ?p <${iri}> .
						BIND(<${iri}> AS ?o)
					}
				}
				UNION
				{
					GRAPH ?g {
						?s ?p <${iri}> .
						BIND(<${iri}> AS ?o)
					}
				}
			}		
		`;
        return await this.selectQuery(query);
	}

	async getSubjectMentions(iri: string): Promise<SelectQueryResult> {
		const query = `
			SELECT (?s as ?subject) (?p as ?predicate) (?o as ?object) (?g as ?context) WHERE {
				{
					GRAPH <${NIL_IRI}> {
						<${iri}> ?p ?o .
						BIND(<${iri}> AS ?s)
					}
				}
				UNION
				{
					GRAPH <${NIL_IRI}> {
						?s <${iri}> ?o .
						BIND(<${iri}> AS ?p)
					}
				}
				UNION
				{
					GRAPH <${NIL_IRI}> {
						?s ?p <${iri}> .
						BIND(<${iri}> AS ?o)
					}
				}
				UNION
				{
					GRAPH ?g {
						<${iri}> ?p ?o .
						BIND(<${iri}> AS ?s)
					}
				}
				UNION
				{
					GRAPH ?g {
						?s <${iri}> ?o .
						BIND(<${iri}> AS ?p)
					}
				}
				UNION
				{
					GRAPH ?g {
						?s ?p <${iri}> .
						BIND(<${iri}> AS ?o)
					}
				}
				UNION
				{
					GRAPH <${iri}> {
						?s ?p ?o .
						BIND(<${iri}> AS ?g)
					}
				}
			}		
		`;
        return await this.selectQuery(query);
	}

    async getSubjectValue(subjectIri: string, propertyIri: string): Promise<RdfValue> {
		const url = this.repositoryEndpoint() + '/subject/' + encodeURIComponent(subjectIri) + '/' + encodeURIComponent(propertyIri);
		let response = await fetch(url, {
			method: 'GET',
			headers: this.headers()
		});
		this.checkAuth(response);
		const data = await response.json();
		return data;
	}

	async selectQuery(query: string, limit?: number): Promise<SelectQueryResult> {
		const qlimit = (limit === undefined) ? QUERY_LIMIT : limit
		const url = this.repositoryEndpoint() + '?limit=' + qlimit;
		let response = await fetch(url, {
			method: 'POST',
			headers: this.headers({
				'Content-Type': 'application/sparql-query',
				'Accept': 'application/json'
			}),
			body: query
		});
		this.checkAuth(response);
		if (!response.ok) {
			let error = response.status;
			throw new Error('Error ' + error.toString());
		}
		const data = await response.json();
		return data;
	}

	async askQuery(query: string, limit?: number): Promise<AskQueryResult> {
		const qlimit = (limit === undefined) ? QUERY_LIMIT : limit
		const url = this.repositoryEndpoint() + '?limit=' + qlimit;
		let response = await fetch(url, {
			method: 'POST',
			headers: this.headers({
				'Content-Type': 'application/sparql-query',
				'Accept': 'application/json'
			}),
			body: query
		});
		this.checkAuth(response);
		if (!response.ok) {
			let error = response.status;
			throw new Error('Error ' + error.toString());
		}
		const data = await response.json();
		return data;
	}

	async constructQuery(query: string, accept: string, limit?: number): Promise<string> {
		const qlimit = (limit === undefined) ? QUERY_LIMIT : limit
		const url = this.repositoryEndpoint() + '?limit=' + qlimit;
		let response = await fetch(url, {
			method: 'POST',
			headers: this.headers({
				'Content-Type': 'application/sparql-query',
				'Accept': accept
			}),
			body: query
		});
		this.checkAuth(response);
		if (!response.ok) {
			let error = response.status;
			throw new Error('Error ' + error.toString());
		}
		const data = await response.text();
		return data;
	}

	async updateQuery(query: string): Promise<UpdateQueryResult> {
		const url = this.repositoryEndpoint() + '/statements';
		let response = await fetch(url, {
			method: 'POST',
			headers: this.headers({
				'Content-Type': 'application/sparql-update'
			}),
			body: query
		});
		this.checkAuth(response);
		if (!response.ok) {
			let error = response.status;
			throw new Error('Error ' + error.toString());
		}
		return { success: true };
	}

	async getContexts(): Promise<ContextDescription[]> {
		const url = this.repositoryEndpoint() + '/contexts';
		let response = await fetch(url, {
			method: 'GET',
			headers: this.headers({
				'Accept': 'application/json'
			})
		});
		this.checkAuth(response);
		if (!response.ok) {
			let error = response.status;
			throw new Error('Error ' + error.toString());
		}
		const resp = await response.json();
		let ret = [];
		for (let bind of resp.results.bindings) {
			ret.push({ iri: bind.contextID.value });
		}
		return ret;
	}

	async exportContext(contextIri: string, mime: string, thenFunction: (blob: Blob) => void) {
		const url = this.repositoryEndpoint() + '/statements?context=' + encodeURIComponent('<' + contextIri + '>');
		let response = await fetch(url, {
			method: 'GET',
			headers: this.headers({
				'Accept': mime
			})
		})
		this.checkAuth(response);
		if (!response.ok) {
			let error = response.status;
			throw new Error('Error ' + error.toString());
		}
		response.blob().then(thenFunction);
	}

	async replaceContext(contextIri: string, mime: string, data: string): Promise<void> {
		const url = this.repositoryEndpoint() + '/statements?context=' + encodeURIComponent('<' + contextIri + '>');
		let response = await fetch(url, {
			method: 'PUT',
			headers: this.headers({
				'Content-Type': mime
			}),
			body: data
		})
		this.checkAuth(response);
		if (!response.ok) {
			let data = await response.json();
			throw new Error(data.message);
		}
	}

	async deleteContext(contextIri: string): Promise<boolean> {
		const url = this.repositoryEndpoint() + '/statements?context=' + encodeURIComponent('<' + contextIri + '>');
		let response = await fetch(url, {
			method: 'DELETE',
			headers: this.headers()
		})
		this.checkAuth(response);
		if (!response.ok) {
			let error = response.status;
			throw new Error('Error ' + error.toString());
		}
		const data = await response.json();
		return data.status == 'ok';
	}

	async listRepositories(): Promise<RepositoryInfo[]> {
		const url = this.serverUrl + '/repositories';
		try {
			let response = await fetch(url, {
				method: 'GET',
				headers: this.headers({
					'Accept': 'application/json'
				})
			});

			this.checkAuth(response);
			if (!response.ok) {
				let data = await response.json();
				throw new Error(data.message);
			}

			const data = await response.json();
			let ret = [];
			for (let repo of data.results.bindings) {
				ret.push({ id: repo.id.value, title: repo.title.value });
            }
			return ret;
		} catch (e) {
			throw new Error(errMsg(e));
		}		
	}

	async getNamespaces(): Promise<SelectQueryResult> {
		const url = this.repositoryEndpoint() + '/namespaces';
		try {
			let response = await fetch(url, {
				method: 'GET',
				headers: this.headers({
					'Accept': 'application/json'
				})
			});

			this.checkAuth(response);
			if (!response.ok) {
				let data = await response.json();
				throw new Error(data.message);
			}

			const data: SelectQueryResult = await response.json();
			return data;
		} catch (e) {
			throw new Error(errMsg(e));
		}		
	}

	async getNamespacesCached(): Promise<SelectQueryResult> {
		if (!this.cachedNamespaces) {
			this.cachedNamespaces = await this.getNamespaces();
		}
		return this.cachedNamespaces;
	}

	async getIriDecoder() {
		if (!this.iriDecoder) {
			let ns: { [key: string]: string; } = {};
			try {
                let data: SelectQueryResult = await this.getNamespaces();
				ns = {};
				for (let bind of data.results.bindings) {
					ns[bind.prefix.value] = bind.namespace.value;
				}
            } catch (e) {
                //throw new Error('Error fetching namespaces:'+ e);
            }
            this.iriDecoder = new IriDecoder(ns);
        }
		return this.iriDecoder;
	}

	//================================================================================

	checkAuth(response: Response): boolean {
		if (response.status == 401 || response.status == 403) {
			if (this.onNotAuthorized) {
				this.onNotAuthorized();
			}
			return false;
		} else {
			return true;
		}
	}

	headers(headers?: { [key: string]: string }): { [key: string]: string } {
		const src = headers ? headers : {};
		if (this.serverLogin && this.serverPassword) {
            const basicAuth = btoa(this.serverLogin + ':' + this.serverPassword);
			return {
				...src,
				'Authorization': 'Basic ' + basicAuth,
			};
		} else {
			return src;
		}
	}

	//================================================================================

	async getSavedQueries(): Promise<SavedQuery[]> {
		let json = localStorage.getItem(QUERIES_STORAGE_KEY);
		if (json) {
            let queries: SavedQuery[] = JSON.parse(json);
			// assign id to each query
			queries.forEach((q, i) => {
                q.id = i + 1;
            });
            return queries;
        } else {
            return [];
        }
	}

	async saveQuery(data: SavedQuery) {
		let queries = await this.getSavedQueries();
        queries.push(data);
        localStorage.setItem(QUERIES_STORAGE_KEY, JSON.stringify(queries));
	}

	async deleteQuery(queryId: number): Promise<void> {
		let queries = await this.getSavedQueries();
        queries = queries.filter(q => q.id !== queryId);
        localStorage.setItem(QUERIES_STORAGE_KEY, JSON.stringify(queries));
	}

	//================================================================================

	/**
	 * Transforms an RDF Binding into a JavaScript object.
	 * @param {RdfValueBinding} binding 
	 * @returns An object with properties from the binding.
	 */
	toObject(binding: RdfValueBinding): object {
		const obj: {[k: string]: any} = {};
        for (let prop in binding) {
			let bind = binding[prop];
			let val;
			if (bind.datatype && bind.datatype === 'http://www.w3.org/2001/XMLSchema#boolean') {
				val = (bind.value === 'true');
			} else if (bind.datatype && bind.datatype === 'http://www.w3.org/2001/XMLSchema#integer') {
				val = parseInt(bind.value);
			} else if (bind.datatype && bind.datatype === 'http://www.w3.org/2001/XMLSchema#decimal') {
				val = parseFloat(bind.value);
			} else {
                val = bind.value;
            }
            obj[prop] = val;
        }
        return obj;
	}

	/**
	 * Transforms an array of RDF Bindings into an array of JavaScript objects.
	 * @param {*} bindings 
	 * @returns 
	 */
	toObjectArray(bindings: RdfValueBinding[]): object[] {
		return bindings.map(binding => this.toObject(binding));
    }

}
