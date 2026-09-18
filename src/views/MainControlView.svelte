<script lang="ts">
    import Button from '$component/Button.svelte';
	import RadioInput from '$component/RadioInput.svelte';
	import SliderDoubleInput from '$component/SliderDoubleInput.svelte';
	import SliderInput from '$component/SliderInput.svelte';
	import NumericInput from '$component/NumericInput.svelte';
	import CheckboxInput from '$component/CheckboxInput.svelte';
    import './MainControlView.scss';

	import type { ViewManager, ViewManagerProps } from '$lib/state/viewManager.svelte.ts';
	import type { OssmDevice } from '$lib/services/OssmDevice.svelte.ts';
	import { isDevMode, mediaQuery } from '$lib/utils/Helpers.svelte.ts';

    interface Props extends ViewManagerProps {
        readonly viewManager: ViewManager;
        readonly ossmInstance: OssmDevice;
    }
    let {
        viewManager,
        ossmInstance
    }: Props = $props();

    const isLandscape = mediaQuery('(orientation: landscape)');
    const orientation = $derived(isLandscape.matches ? 'horizontal' : 'vertical');

    // TODO: Move these states to the code behind (.ts file). This exists here as a temporary placeholder

    // #region Connection states
    let connectionState = $state<'disconnected' | 'reconnecting' | 'connected'>('disconnected');
    let disableControls = $derived(connectionState !== 'connected');
    if (isDevMode && new URLSearchParams(globalThis.location?.search).get('viewOverride'))
        connectionState = 'connected'; // For development mode, override the connection state to connected
    // #endregion

    // #region Pattern states
    let patterns = $state<Record<string, { name: string; description: string }>>({
        // Sample data for patterns
        'pattern-0': {
            name: 'Pattern 1',
            description: 'Lorem ipsum dolor sit amet'
        },
        'pattern-1': {
            name: 'Pattern 2',
            description: 'consectetur adipiscing elit'
        }
    });
    let selectedPattern = $state('pattern-0');
    const selectedPatternDescription = $derived(patterns[selectedPattern]?.description ?? 'No pattern selected');
    // Use $effect to auto select the first key if a pattern is not selected? (for now no because it will be set by the machine state when active)
    // #endregion

    // #region Control states
    let minGap = 1;
    let controlRange = $state({
        from: 0,
        to: 10
    });
    let controlSpeed = $state(0);
    let controlIntensity = $state(50);
    let controlInvertIntensity = $state(false);
    // #endregion
</script>

<main class="fill-page">
    <section class="control-screen">
        <div class="status card">
            <div>
                <p class="state-indicator" data-state={connectionState} data-text={connectionState[0].toUpperCase() + connectionState.slice(1)}>
                    <span class="material-symbol fill small" data-icon="circle"></span>
                </p>
            </div>
            <div>
                <!-- TODO: Future feature; session sharing -->
                 <Button aria-label="Reset settings" icon="reset_settings" />
                 <Button aria-label="Disconnect" icon="logout" click={() => { /* TODO: Disconnect device & navigate view manager to home view */ }} />
                 <Button class="stop-button" aria-label="Stop" icon="dangerous" />
            </div>
        </div>

        <div
            class="options-and-controls"
            class:scale-pulse={connectionState === 'reconnecting'}>
            <div class="options card">
                <div class="patterns-panel">
                    <div class="pattern-list">
                        <h3>Patterns</h3>
                        <div class="pattern-select">
                            {#each Object.entries(patterns) as [key, { name }] (key)}
                                <RadioInput
                                    group="pattern"
                                    checked={selectedPattern === key}
                                    onchange={() => (selectedPattern = key)}
                                    disabled={disableControls}>
                                    {name}
                                </RadioInput>
                            {/each}
                        </div>
                    </div>
                    <div class="pattern-settings">
                        <p class="description-text">{selectedPatternDescription}</p>
                    </div>
                </div>
            </div>

            <div class="controls card">
                <!-- Range Control -->
                <div>
                    <NumericInput
                        spin="split"
                        min={controlRange.from + minGap}
                        max={100}
                        bind:value={controlRange.to}
                        disabled={disableControls}
                    />
                    <div class="glass-border">
                        <SliderDoubleInput
                            orientation={orientation}
                            min={0}
                            max={100}
                            bind:from={controlRange.from}
                            bind:to={controlRange.to}
                            minGap={minGap}
                            disabled={disableControls}
                        />
                        <span class="material-symbol no-offset" data-icon="arrow_range"></span>
                    </div>
                    <NumericInput
                        spin="split"
                        min={0}
                        max={controlRange.to - minGap}
                        bind:value={controlRange.from}
                        disabled={disableControls}
                    />
                </div>

                <!-- Speed Control -->
                <div>
                    <div></div> <!-- Placeholder element to maintain the layout -->
                    <div class="glass-border">
                        <SliderInput
                            orientation={orientation}
                            min={0}
                            max={100}
                            bind:value={controlSpeed}
                            disabled={disableControls}
                        />
                        <span class="material-symbol no-offset" data-icon="speed"></span>
                    </div>
                    <NumericInput
                        spin="split"
                        min={0}
                        max={100}
                        bind:value={controlSpeed}
                        disabled={disableControls}
                    />
                </div>

                <!-- Intensity Control -->
                <div>
                    <CheckboxInput
                        class="invert-intensity"
                        checkedIcon="flip"
                        uncheckedIcon="flip"
                        bind:checked={controlInvertIntensity}
                        disabled={disableControls}
                    />
                    <div class="glass-border">
                        <SliderInput
                            orientation={orientation}
                            min={0}
                            max={100}
                            bind:value={controlIntensity}
                            disabled={disableControls}
                        />
                        <span class="material-symbol no-offset" data-icon="nest_true_radiant"></span>
                    </div>
                    <NumericInput
                        spin="split"
                        min={0}
                        max={100}
                        bind:value={controlIntensity}
                        disabled={disableControls}
                    />
                </div>
            </div>
        </div>
    </section>
</main>
