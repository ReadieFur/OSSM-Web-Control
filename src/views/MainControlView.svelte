<script lang="ts">
    // UI imports
    import Button from '$component/Button.svelte';
	import RadioInput from '$component/RadioInput.svelte';
	import SliderDoubleInput from '$component/SliderDoubleInput.svelte';
	import SliderInput from '$component/SliderInput.svelte';
	import NumericInput from '$component/NumericInput.svelte';
	import CheckboxInput from '$component/CheckboxInput.svelte';
    import './MainControlView.scss';

    // Logic imports
    import { mediaQuery } from '$lib/utils/Helpers.svelte.ts';
    import { MainControlView, type Props } from './MainControlView.svelte.ts';

    let props: Props = $props();
    const self = new MainControlView(() => props);

    const isLandscape = mediaQuery('(orientation: landscape)');
    const orientation = $derived(isLandscape.matches ? 'horizontal' : 'vertical');
    const minGap = 1;
</script>

<main class="fill-page">
    <section class="control-screen">
        <div class="status card">
            <div>
                <p class="state-indicator" data-state={self.connectionState} data-text={self.connectionState[0].toUpperCase() + self.connectionState.slice(1)}>
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
            class:scale-pulse={self.connectionState === 'reconnecting'}>
            <div class="options card">
                <div class="patterns-panel">
                    <div class="pattern-list">
                        <h3>Patterns</h3>
                        <div class="pattern-select">
                            {#each Object.entries(self.patterns) as [key, { name }] (key)}
                                <RadioInput
                                    group="pattern"
                                    checked={self.selectedPattern === key}
                                    onchange={() => (self.selectedPattern = key)}
                                    disabled={self.disableControls}>
                                    {name}
                                </RadioInput>
                            {/each}
                        </div>
                    </div>
                    <div class="pattern-settings">
                        <p class="description-text">{self.selectedPatternDescription}</p>
                    </div>
                </div>
            </div>

            <div class="controls card">
                <!-- Range Control -->
                <div>
                    <NumericInput
                        spin="split"
                        spinOnly
                        min={self.controlRange.from + minGap}
                        max={100}
                        bind:value={self.controlRange.to}
                        disabled={self.disableControls}
                    />
                    <div class="glass-border">
                        <SliderDoubleInput
                            orientation={orientation}
                            min={0}
                            max={100}
                            bind:from={self.controlRange.from}
                            bind:to={self.controlRange.to}
                            minGap={minGap}
                            disabled={self.disableControls}
                        />
                        <span class="material-symbol no-offset" data-icon="arrow_range"></span>
                    </div>
                    <NumericInput
                        spin="split"
                        spinOnly
                        min={0}
                        max={self.controlRange.to - minGap}
                        bind:value={self.controlRange.from}
                        disabled={self.disableControls}
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
                            bind:value={self.controlSpeed}
                            disabled={self.disableControls}
                        />
                        <span class="material-symbol no-offset" data-icon="speed"></span>
                    </div>
                    <NumericInput
                        spin="split"
                        spinOnly
                        min={0}
                        max={100}
                        bind:value={self.controlSpeed}
                        disabled={self.disableControls}
                    />
                </div>

                <!-- Intensity Control -->
                <div>
                    <CheckboxInput
                        class="invert-intensity"
                        checkedIcon="flip"
                        uncheckedIcon="flip"
                        bind:checked={self.controlInvertIntensity}
                        disabled={self.disableControls}
                    />
                    <div class="glass-border">
                        <SliderInput
                            orientation={orientation}
                            min={0}
                            max={100}
                            bind:value={self.controlIntensity}
                            disabled={self.disableControls}
                        />
                        <span class="material-symbol no-offset" data-icon="nest_true_radiant"></span>
                    </div>
                    <NumericInput
                        spin="split"
                        spinOnly
                        min={0}
                        max={100}
                        bind:value={self.controlIntensity}
                        disabled={self.disableControls}
                    />
                </div>
            </div>
        </div>
    </section>
</main>
