<template>
	<router-link class="p-button p-component link-button" :class="mainClass"
		:to="to"
		:target="target">
		<span v-if="icon" :class="icon" class="p-button-icon p-button-icon-left"></span>
		<span class="p-button-label">{{mainText}}</span>
	</router-link>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
	name: 'LinkButton',
	props: {
		to: null,
		target: null,
		icon: null,
		label: null
	},
	computed: {
		mainClass() {
			if (!this.label && this.icon) {
				return 'p-button-icon-only';
			} else {
				return '';
			}
		},
		mainText() {
			return this.label ? this.label : '&nbsp;';
		}
	}
});
</script>

<style>
.link-button {
	text-decoration: none;
}
.link-button:hover {
	filter: brightness(0.95);
}
</style>
