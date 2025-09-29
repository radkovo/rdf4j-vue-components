export default class IriDecoder {

	// Default namespaces, will be extended in constuctor
	namespaces: { [key: string]: string } = {
		rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
		rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
		xsd: 'http://www.w3.org/2001/XMLSchema#',
		owl: 'http://www.w3.org/2002/07/owl#',
	};

	constructor(newNamespaces: { [key: string]: string }) {
		if (newNamespaces) {
            this.namespaces = {...this.namespaces, ...newNamespaces};
        }
    }

	decodeIri(shortForm: string): string {
		const si = shortForm.indexOf(':');
		if (si > 0) {
			const prefix = shortForm.substring(0, si);
			for (let key in this.namespaces) {
				if (prefix === key) {
					const suffix = shortForm.substring(si + 1);
					return this.namespaces[key] + suffix;
				}
			}
		}
		return shortForm;
	}

	encodeIri(longForm: string): string {
		for (let key in this.namespaces) {
			const iprefix = this.namespaces[key];
			if (longForm.indexOf(iprefix) === 0) {
				return key + ':' + longForm.substring(iprefix.length);
			}
		}
		return longForm;
	}

}
