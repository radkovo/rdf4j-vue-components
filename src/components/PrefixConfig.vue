<template>
	<div class="prefix-config">
		<DataTable :value="namespaces" tableStyle="min-width: 50rem" class="p-datatable-small"
			scrollable scrollHeight="30em">
			<template #empty> No prefixes defined. </template>
			<Column field="prefix" header="Prefix" sortable></Column>
			<Column field="namespace" header="Namespace" sortable></Column>
		</DataTable>
	</div>
</template>

<script lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import type { ApiClient } from '../common/apiclient';
import type { NamespaceDef } from '../common/types';

import { defineComponent, inject } from 'vue';

export default defineComponent({
    name: 'PrefixConfig',
	setup() {
		return {
			apiClient: inject('apiClient') as ApiClient
		}
	},
    props: {
    },
    components: {
        DataTable,
        Column
    },
    data (): {
        namespaces: NamespaceDef[]
    } {
        return {
            namespaces: [],
        }
    },
    created () {
    },
    mounted () {
        this.fetchNamespaces();
    },
    methods: {
        async fetchNamespaces() {
            let ns = [];
            let data = await this.apiClient.getNamespaces();
            for (let bind of data.results.bindings) {
                ns.push({prefix: bind.prefix.value, namespace: bind.namespace.value});
            }
            this.namespaces = ns;
        },
    }
})
</script>

<style>
</style>
