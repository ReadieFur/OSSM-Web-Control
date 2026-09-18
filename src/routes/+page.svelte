<script lang="ts">
    // Imports
    import { onMount, type Component } from 'svelte';
    import { ViewManager } from '$lib/state/viewManager.svelte';
    import Footer from '$component/Footer.svelte';
    import LandingView from '$view/LandingView.svelte';
    import { svelteFade } from '$lib/utils/animation.ts';
	import { isDevMode } from '$lib/utils/helpers';

    // Styles
    import '$lib/styles/global.scss';
    import '$lib/styles/layout.scss';

    // Initial app state
    let appShellVisible = $state(false);
    let initialView = LandingView;

    // View manager
    const vm = new ViewManager(initialView);
    let ActiveView = $derived(vm.activeView);

    // Development mode view override
    let devViewOverride = $state<boolean>(false);
    (() => {
        if (!isDevMode) return;

        const pageParam = new URLSearchParams(globalThis.location?.search).get('viewOverride');
        if (!pageParam) return;

        const viewModules = import.meta.glob<{ default: Component }>('/src/views/**/*.svelte');

        for (const view in viewModules) {
            const fileName = view.split('/').pop()?.replace('.svelte', '') ?? '';
            if (fileName === pageParam) {
                devViewOverride = true;
                viewModules[view]()
                    .then((module) => { vm.activeView = module.default; })
                    .catch((error) => console.error('[DEV] Error loading view module:', error));
                return; // Return early
            }
        }
        console.warn(`[DEV] View "${pageParam}" not found`);
    })();

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

{#if devViewOverride}
<div class="app-shell">
    <!-- Dev view override (disables navigation animations) -->
    <ActiveView viewManager={vm} />
</div>

{:else if appShellVisible}
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
