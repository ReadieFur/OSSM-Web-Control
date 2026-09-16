<script lang="ts">
    import { ViewManager } from '$views/ViewManager.svelte.ts';
    import LandingView from '$views/LandingView.svelte';

    const vmm = new ViewManager();
</script>

{#if vmm.currentView === 'landing'}
    <LandingView {vmm} />
{/if}
