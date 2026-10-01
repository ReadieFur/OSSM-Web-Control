<script>
	/* This file is mostly unused. The app acts as an SPA through my custom ViewManager service instantiated in +page.svelte.
	 * The reason this file exists is to preload any resources in the statically compiled output.
	 * Currently we preload the main scss file to prevent flickering on first page load as imports here are render blocking.
	 */

	import "$lib/styles/global.scss";

	let { children } = $props();
</script>

<div class="app-background"></div>

{@render children()}
