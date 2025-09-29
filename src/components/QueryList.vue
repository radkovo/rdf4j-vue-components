<template>
	<div class="query-list" v-if="queries">
		<DataTable :value="queries" 
			v-model:filters="dFilters" filterDisplay="row"
			:scrollable="true" scrollHeight="flex"
            selectionMode="single" dataKey="id"
            @rowSelect="selectRow" @rowDblclick="useRow"
			showGridlines>
            <Column header="ID" field="id" sortable>
            </Column>
			<Column header="Title" filterField="title" field="title" sortable>
				<template #filter="{filterModel,filterCallback}">
					<InputText type="text" v-model="filterModel.value" @keydown.enter="filterCallback()" class="p-column-filter" :placeholder="`Search by title - `" v-tooltip.top.focus="'Hit enter key to filter'"/>
				</template>												
			</Column>
			<Column>
				<template #body="slotProps">
					<Button icon="pi pi-times" severity="danger" text rounded aria-label="Delete" v-tooltip="'Delete query'"
						@click="deleteQuery(slotProps.data.id, slotProps.data.title)" />
				</template>
			</Column>
		</DataTable>
		<ConfirmDialog group="confirmDeleteQuery"></ConfirmDialog>
	</div>
</template>

<script lang="ts">
import Button from 'primevue/button';
import DataTable, { type DataTableFilterMeta } from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import ConfirmDialog from 'primevue/confirmdialog';

import {FilterMatchMode} from '@primevue/core/api';
import { type ApiClient } from '@/common/apiclient';
import type { SavedQuery } from '@/common/types';
import { defineComponent, inject } from 'vue';

export default defineComponent({
	name: 'QueryList',
	components: {
		Button,
		InputText,
		DataTable,
		Column,
		ConfirmDialog
	},
    emits: ['select-query', 'use-query'],
	props: {
	},
	setup() {
		return {
			apiClient: inject('apiClient') as ApiClient
		}
	},
	data (): {
		queries: SavedQuery[] | null,
		selectedRow: SavedQuery | null,
		dFilters: DataTableFilterMeta
	} {
		return {
			queries: null,
            selectedRow: null,
			dFilters: {
				'title': {value: null, matchMode: FilterMatchMode.CONTAINS},
			}			
		}
	},
	created () {
		this.update();
	},
	methods: {
		async update() {
            const data = await this.apiClient.getSavedQueries();
            this.queries = data;
		},

        selectRow(ev: any) {
            this.$emit('select-query', ev.data);
        },

        useRow(ev: any) {
            this.$emit('use-query', ev.data);
        },

		deleteQuery(id: number, title: string) {
			this.$confirm.require({
				group: 'confirmDeleteQuery',
                message: `Are you sure to delete the query '${title}'?`,
                header: 'Query deletion',
                icon: 'pi pi-exclamation-triangle',
                accept: async () => {
					try {
						await (this.apiClient as ApiClient).deleteQuery(id);
						this.$toast.add({severity:'success', summary: 'Success', detail:'Query deleted', life: 3000});
					} catch (e: any) {
						this.$toast.add({severity:'error', summary: 'Error', detail: e.message, life: 5000});
					}
					this.update();
                },
                reject: () => {
                }
            });
		}

	}
});
</script>

<style>
</style>
