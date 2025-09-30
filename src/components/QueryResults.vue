<template>
    <div v-if="result.type != 'clear'">
        <div v-if="result.type != 'ask' && result.type != 'update'">
            <DataTable :value="rawValues" responsiveLayout="scroll" :paginator="true" paginatorPosition="both" :rows="50"
                paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
                :rowsPerPageOptions="[50, 200, 500, 1000, 2500]" currentPageReportTemplate="Showing {first} to {last} of {totalRecords}"
                filterDisplay="row" v-model:filters="filters" ref="dt">
                <template #empty>
                    No data found.
                </template>
                <template #loading>
                    Loading data. Please wait.
                </template>
                <template #header>
                    <div class="text-end pb-4">
                        <Button icon="pi pi-external-link" label="Export" @click="exportCSV" />
                    </div>
                </template>                

                <Column v-for="(col, i) in columns" :field="col + 'f'" :header="col" :key="i" :filterField="`${col}f`">
                    <template #body="slotProps">
                        <slot name="value" v-bind="slotProps.data[col]">
                            {{ slotProps.data[col].value }}
                        </slot>
                    </template>
                    <template #filter="{ filterModel, filterCallback }">
                        <InputText type="text" v-model="filterModel.value" @keydown.enter="filterCallback()"
                            class="p-column-filter" :placeholder="`Search by ${filterModel.matchMode}`"
                            v-tooltip.top.focus="'Hit enter key to filter'" />
                    </template>
                </Column>

            </DataTable>
        </div>
        <div v-else-if="result.type == 'ask'">
            <!--Boolean result -->
            <h3>The result of query is: {{ askRes ? "Yes" : "No" }}</h3>
            <i v-if="askRes" class="pi pi-check" style="color:green; font-weight:bold"></i>
            <i v-else class="pi pi-times" style="color:red; font-weight:bold"></i>
        </div>
        <div v-else-if="result.type == 'update'">
            <h3>The update query was successful
                <i class="pi pi-check" style="color:green; font-weight:bold"></i>
            </h3>
        </div>
    </div>
</template>

<script lang="ts">
import DataTable, { type DataTableFilterMeta, type DataTableMethods } from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';

import { FilterMatchMode } from '@primevue/core/api';

import { Parser, type Quad, type Term } from "n3";
import { defineComponent, type PropType } from 'vue';
import type { RdfValueSpec, RdfValueBinding, QueryResult, SelectQueryResult, NamespaceDef } from '@/common/types';

// parser for N3 construct queries 
const n3Parser = new Parser({ format: 'N-Triples' })

export default defineComponent({
    name: 'QueryResults',
    props: {
        result: {
            type: Object as PropType<QueryResult>,
            required: true
        }
    },
    components: {
        DataTable,
        Column,
        InputText,
        Button
    },
    data(): {
        rawValues: RdfValueBinding[],
        columns: string[],
        showUserQueryRes: boolean,
        resource: string | null,
        filters: DataTableFilterMeta,
        askRes: boolean | undefined
    } {
        return {
            // raw values
            rawValues: [],
            // name of columns in the table
            columns: [],
            // show the table if data is available
            showUserQueryRes: false,
            // resource clicked by user for further exploration
            resource: null,
            filters: {
                global: { value: null, matchMode: FilterMatchMode.CONTAINS }
            },
            // the query was typ of ASK (boolean result)
            askRes: undefined
        }
    },
    mounted() {
        this.processResponse();
    },
	watch: {
		result: 'processResponse'
	},
    methods: {
        // function activating resource exploration component
        exploreResource(resource: string) {
            this.filters = {};
            // base column filter
            this.filters['global'] = { value: null, matchMode: FilterMatchMode.CONTAINS };

            this.resource = resource;
            // if data exists for the chosen resource
            if (this.resource !== '')
                this.showUserQueryRes = true;
        },

        // set needed variables based on the response for its correct visualization
        processResponse() {
            this.rawValues = [];
            this.columns = [];
            if (this.result) {
                console.log('Processing response:', this.result);
                // hide table and ask result
                this.showUserQueryRes = false;
                this.askRes = undefined;

                if (this.result.type == 'ask') {
                    // ASK query 
                    this.askRes = this.result.data.boolean;
                } else if (this.result.type == 'select') {
                    // SELECT query   
                    this.processSelectResult(this.result);
                } else if (this.result.type == 'construct') {
                    // CONSTRUCT query
                    this.processConstructResult(this.result);
                }
            }
            console.log('Processed result:', this.rawValues);
        },

        // parse the content of the construct query response
        processConstructResult(res: Extract<QueryResult, { type: "construct" }>) {
            // store column headers 
            this.columns = ['subject', 'predicate', 'object', 'context'];
            this.filters['subjectf'] = { value: null, matchMode: FilterMatchMode.CONTAINS };
            this.filters['predicatef'] = { value: null, matchMode: FilterMatchMode.CONTAINS };
            this.filters['objectf'] = { value: null, matchMode: FilterMatchMode.CONTAINS };
            this.filters['contextf'] = { value: null, matchMode: FilterMatchMode.CONTAINS };

            // loop processing response and transforming it to row data  
            // parse the n-triples data from the answer
            n3Parser.parse(
                res.data,
                (error, quad, prefixes) => {
                    let q: Quad = quad;
                    // one quad represents one triple from teh answer
                    if (quad) {
                        let rawRow: RdfValueBinding = {
                            'subject': this.transformQuadPart(q.subject),
                            'predicate': this.transformQuadPart(q.predicate),
                            'object': this.transformQuadPart(q.object),
                            'context': this.transformQuadPart(q.graph),
                            'subjectf': this.formatQuadPart(q.subject, res.prefixes),
                            'predicatef': this.formatQuadPart(q.predicate, res.prefixes),
                            'objectf': this.formatQuadPart(q.object, res.prefixes),
                            'contextf': this.formatQuadPart(q.graph, res.prefixes),
                        }
                        this.rawValues.push(rawRow);
                    }
                });
        },

        /**
         * Transforms a quad part into a binding object with the appropriate type and datatype
         */
        transformQuadPart(term: Term): RdfValueSpec {
            switch (term.termType) {
                case 'Literal':
                    return {
                        type: 'literal',
                        value: term.value,
                        datatype: term.datatype.value
                    };
                case 'NamedNode':
                    return {
                        type: 'uri',
                        value: term.value,
                    };
                default:
                    return {
                        type: 'literal',
                        value: term.value,
                    };
            }    
        },

        /**
         * Formats a quad part into a string usable for searching and sorting
         */
        formatQuadPart(term: Term, prefixes: NamespaceDef[]): RdfValueSpec {
            let val = term.toString();
            // replace namespace with prefix if present
            prefixes.forEach((el) => {
                val = val.replace(el.namespace, el.prefix + ':');
            })
            return { value: val, type: 'literal' };
        },

        // parse the content of the select query response
        processSelectResult(res: Extract<QueryResult, { type: "select" }>) {
            // store column headers 
            res.data.head.vars.forEach((item) => {
                this.columns.push(
                    item
                );
                this.filters[item + 'f'] = { value: null, matchMode: FilterMatchMode.CONTAINS };
            })
            // loop processing response and transforming it to row data  
            res.data.results.bindings.forEach((element) => {
                let rawRow: RdfValueBinding = {};
                // process one row data
                this.columns.forEach((item) => {
                    if (element[item]) {
                        rawRow[item] = element[item];

                        // the value that will be used for filtering and sorting
                        let val = element[item].value;
                        // replace namespace with prefix if present
                        res.prefixes.forEach((el) => {
                            val = val.replace(el.namespace, el.prefix + ':');
                        })
                        rawRow[item + 'f'] = { value: val, type: 'literal' };
                    }
                })
                // store row data
                this.rawValues.push(rawRow);
            })
        },

        // export data to CSV
        exportCSV() {
            (this.$refs.dt as DataTableMethods).exportCSV();
        }

    }

});
</script>

<style>
</style>
