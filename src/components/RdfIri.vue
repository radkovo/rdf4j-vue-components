<template>
    <a class="iri-link" v-if="active" @click="clicked" @mouseover="hoverIri" @mouseout="leaveIri">
        <span class="iri font-monospace" v-tooltip.bottom="iri">{{ shortForm }}</span>
    </a>
    <span class="iri font-monospace" v-if="!active" v-tooltip.bottom="iri">{{ shortForm }}</span>
</template>

<script lang="ts">
import type { ApiClient } from '../common/apiclient';
import { defineComponent, inject } from 'vue';

export default defineComponent({
	name: 'RdfIri',
	props: {
		iri: {
			// the target IRI
			type: String,
            required: true
		},
		active: {
			// whether the IRI should be displayed clickable and the events should be emitted on click, hover, and leave events
			// when set to false, the IRI will be displayed as a plain text string and the eventual link may be provided
			// as a parent element
			type: Boolean,
            default: false
		}
	},
	emits: ['show-iri', 'hover-iri', 'leave-iri'],
	setup() {
		return {
			apiClient: inject('apiClient') as ApiClient
		}
	},
	data () {
		return {
			shortForm: ''
		}
	},
	created () {
		this.update();
	},
	watch: {
		iri: 'update'
	},
	methods: {
		async update() {
			let dec = await this.apiClient.getIriDecoder();
			this.shortForm = dec.encodeIri(this.iri);
		},

		clicked() {
			this.$emit('show-iri', this.iri);
		},

		hoverIri() {
			this.$emit('hover-iri', this.iri);
		},

		leaveIri() {
			this.$emit('leave-iri', this.iri);
		}
	}
})
</script>

<style>
.iri-link {
	color: var(--p-blue-500);
	text-decoration: none;
	cursor: pointer;
}
.iri {
	border-bottom: 1px dotted;
}
.iri-link:hover .iri {
	border-bottom: 1px solid;
}
</style>
