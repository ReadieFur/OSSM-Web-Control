<script lang="ts">
    // Imports
    import { ViewManager } from '$lib/viewManager.svelte.ts';
    import Footer from '$component/Footer.svelte';
    import LandingView from '$view/LandingView.svelte';
    import { svelteFade } from '$lib/utils/animation.ts';
    import { onMount } from 'svelte';

    // Styles
    import '$lib/styles/global.scss';
    import '$lib/styles/layout.scss';

    let appShellVisible = $state(false);

    // View manager
    const vm = new ViewManager(LandingView);
    let ActiveView = $derived(vm.activeView);

    // PWA registration
    onMount(() => {
        appShellVisible = true; //Triggers the fade-in animation for the app shell

        // Register Service Worker in production builds
        if ('serviceWorker' in navigator /*&& import.meta.env.PROD*/) {
            navigator.serviceWorker
            .register('/service-worker.js', { type: 'module' })
            .then(() => console.log('[PWA] Registration successful'))
            .catch((err) => console.error('[PWA] Registration failed:', err));
        }
    });
</script>

<div class="app-background"></div>

{#if appShellVisible}
    <!-- Wrapper div required for the app shell startup animation due to how Svelte handles the nested blocks -->
    <div in:svelteFade={{ duration: 650, delay: 200 }}>
        {#key ActiveView}
            <!-- App shell wraps the main content and transitions between views -->
            <div class="app-shell" transition:svelteFade={{ duration: 500, switching: true }}>
                <ActiveView viewManager={vm} />
                <Footer /> <!-- Due to how I position the footer (directly under the main content), this must live inside the app-shell -->
            </div>
        {/key}
    </div>
{/if}
