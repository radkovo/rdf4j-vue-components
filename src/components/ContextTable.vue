<template>
	<div class="context-table">
		<ConfirmDialog group="confirmContext"></ConfirmDialog>
		<Dialog header="Edit context" v-model:visible="displayEditor"
				:maximizable=true :modal=true >
			<p class="context-editor-iri">
				<label for="editIri">Context IRI</label>
				<InputText id="editIri" v-model="editIri" />
			</p>
			<Textarea v-model="editorText" rows="30" cols="100" />
			<template #footer>
				<Message v-if="editorError">{{editorError}}</Message>
				<Button label="Cancel" icon="pi pi-times" class="p-button-text"
					@click="closeEditor()" />
                <Button label="Save" icon="pi pi-check" autofocus
					@click="saveEditor()" />
			</template>
		</Dialog>		
		<DataTable :value="contexts" v-model:filters="filters" filterDisplay="row">
			<template #header>
				<div class="context-table-header">
					<Button icon="pi pi-plus" class="p-button-success" v-tooltip.top="'Add new context'" 
						@click="addContext()" />
                    <SplitButton icon="pi pi-cog" :model="serviceMenu" />
                </div>
			</template>
			<Column field="iri" header="IRI">
				<template #filter="{filterModel,filterCallback}">
					<InputText type="text" v-model="filterModel.value" @keydown.enter="filterCallback()" 
						class="p-column-filter" :placeholder="`Search by IRI - `" 
						v-tooltip.top.focus="'Hit enter key to filter'" />
				</template>												
			</Column>
			<Column header="Actions">
				<template #body="slotProps">
					<div class="repository-actions">
						<Button icon="pi pi-pencil" class="p-button-default" style="margin-left: 0.2em"
							v-tooltip.top="'Edit context'"
							@click="editContext(slotProps.data.iri)" />
						<SplitButton icon="pi pi-download" severity="secondary" style="margin-left: 0.2em"
							v-tooltip.top="'Export context'"
							@click="exportDefault(slotProps.data.iri)" 
							:model="createExportMenu(slotProps.data.iri)" />
						<Button icon="pi pi-trash" class="p-button-danger" style="margin-left: 0.2em"
							v-tooltip.top="'Delete context'"
							@click="deleteContext(slotProps.data.iri)" />
					</div> 
				</template>
			</Column>
		</DataTable>
	</div>
</template>

<script lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import SplitButton from 'primevue/splitbutton';
import Button from 'primevue/button';
import ConfirmDialog from 'primevue/confirmdialog';
import Dialog from 'primevue/dialog';
import Textarea from 'primevue/textarea';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';

import {FilterMatchMode} from '@primevue/core/api';
import type { ContextDescription } from '@/common/types';
import type { MenuItem } from 'primevue/menuitem';
import { type ApiClient } from '@/common/apiclient';

import { defineComponent, inject } from 'vue';

export default defineComponent({
	name: 'ContextTable',
	components: {
		DataTable,
		Column,
		SplitButton,
		Button,
		ConfirmDialog,
		Dialog,
		Textarea,
		InputText,
		Message
	},
	setup() {
		return {
			apiClient: inject('apiClient') as ApiClient
		}
	},
	data (): {
		contexts: ContextDescription[] | null,
		displayEditor: boolean,
		editorText: string | null,
		editorError: string | null,
		editIri: string | null,
		filters: any,
		serviceMenu: MenuItem[]
	} {
		return {
			contexts: null,
			displayEditor: false,
			editorText: null,
			editorError: null,
			editIri: null,

			filters: {
                'iri': {value: null, matchMode: FilterMatchMode.CONTAINS}
            },			

			serviceMenu: [] // for future extensions
		}
	},
	created () {
		this.editorText = '';
		this.update();
	},
	watch: {
		iri: 'update'
	},
	methods: {
		async update() {
			this.contexts = await this.apiClient.getContexts();
		},

		exportDefault(iri: string) {
			this.exportContext(iri, 'application/rdf+xml', '.rdf');
		},

		createExportMenu(iri: string): MenuItem[] {
			let items = [];
			// add standard RDF serializations
			items.push(
				{
					label: 'RDF XML',
					command: () => {
						this.exportContext(iri, 'application/rdf+xml', '.rdf');
					}
				},
				{
					label: 'JSON-LD',
					command: () => {
						this.exportContext(iri, 'application/ld+json', '.jsonld');
					}
				},
				{
					label: 'Turtle',
					command: () => {
						this.exportContext(iri, 'text/turtle', '.ttl');
					}
				}
			);
			return items;
		},

		addContext() {
			this.editIri = this.findNewContextName();
			this.editorText = '';
			this.displayEditor = true;
			this.editorError = null;
		},

		editContext(iri: string) {
			let me = this;
			this.editIri = iri;
			this.editorError = null;
			this.apiClient.exportContext(iri, 'text/turtle', async function(blob) {
				me.editorText = await blob.text();
				me.displayEditor = true;
			});
		},

		closeEditor() {
			this.displayEditor = false;
		},
		
		async saveEditor() {
			try {
				if (this.editIri && this.editorText) {
					await this.apiClient.replaceContext(this.editIri, 'text/turtle', this.editorText);
					this.displayEditor = false;
					this.update();
				}
			} catch (error) {
				if (error instanceof Error) {
					this.editorError = error.message;
				}
			}
		},

		exportContext(iri: string, mime: string, ext: string) {
			this.apiClient.exportContext(iri, mime, function(blob) {
				const link = document.createElement('a');
				link.href = URL.createObjectURL(blob);
				link.download = 'export' + ext;
				link.click();
				URL.revokeObjectURL(link.href);
			});
		},

		async deleteContext(iri: string) {
			let dec = await this.apiClient.getIriDecoder();
			let shortIri = dec.encodeIri(iri);
			this.$confirm.require({
				group: 'confirmContext',
                message: 'Are you sure to delete the context ' + shortIri + '?',
                header: 'Context deletion',
                icon: 'pi pi-exclamation-triangle',
                accept: async () => {
					try {
						await this.apiClient.deleteContext(iri);
					} catch (error) {
						console.error('Couldnt delete context!', error);
					}
					this.update();
                },
                reject: () => {
                }
            });
		},

		findNewContextName(): string {
			let n = 1;
			let cname = '';
			do {
				cname = 'file://local/context' + n + '.ttl';
				n++;
			} while (this.contextExists(cname));
			return cname;
		},

		contextExists(iri: string): boolean {
			if (this.contexts) {
				for (let ctx of this.contexts) {
					if (ctx.iri === iri) {
						return true;
					}
				}
			}
			return false;
		}

	}
});
</script>

<style>
.context-editor-iri label {
	font-weight: bold;
	margin-right: 0.3em;
}
.context-table-header {
	display: flex;
	align-items: center;
	justify-content: right;
}
.context-table-header .p-splitbutton {
	margin-left: 1em;
}
</style>
