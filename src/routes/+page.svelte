<script lang="ts">
    import { ViewManager } from '$lib/viewManager.svelte.ts';
    import Footer from '$components/footer.svelte';
    import LandingView from '$views/LandingView.svelte';
    import { delay, prefersReducedMotion } from '$lib/utils/helpers.ts';
    import { transitionFade, TransitionDirection as TD } from '$lib/utils/animation.ts';

    const vm = new ViewManager(LandingView);
    let ActiveView = $derived(vm.activeView);

    function initializeAppShell(appShell: HTMLElement) {
        vm.addEventListener('beforeviewchange', async () => await transitionFade(appShell, TD.Out, 500));
        vm.addEventListener('viewchange', async () => await transitionFade(appShell, TD.In, 500));

        if (!prefersReducedMotion()) {
            (async () => {
                await delay(250);
                appShell.classList.remove('hidden');
                await transitionFade(appShell, TD.In, 650)
            })();
        }
        else {
            appShell.classList.remove('hidden');
        }
    }
</script>

<div class="app-background"></div>

<!-- App shell is initially hidden for our fade-in animation and is made visible in the call to initializeAppShell -->
<main use:initializeAppShell class="hidden">
    <ActiveView viewManager={vm} />
    <!-- Due to how I position the footer (directly under the main content), this must live inside the app-shell -->
    <!-- TODO: Change how footer hooks in (namely with transition states) -->
    <Footer />
</main>

<style lang="scss">
    @import "$lib/styles/global.scss";
    @import "$lib/styles/layout.scss";
</style>
