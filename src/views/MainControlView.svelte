<script lang="ts">
    // UI imports
    import Button from "$component/Button.svelte";
	import RadioInput from "$component/RadioInput.svelte";
	import SliderDoubleInput from "$component/SliderDoubleInput.svelte";
	import SliderInput from "$component/SliderInput.svelte";
	import NumericInput from "$component/NumericInput.svelte";
	import CheckboxInput from "$component/CheckboxInput.svelte";
    import "./MainControlView.scss";
    
    // Logic imports
    import { mediaQuery } from "$lib/utils/Helpers.svelte";
    import { MainControlView, type Props } from "./MainControlView.svelte.ts";
    import type { RangeChangeEvent } from "$component/SliderDoubleInput.svelte";
	import { svelteFade } from "$lib/utils/Animation.svelte";

    let props: Props = $props();
    const self = new MainControlView(() => props);

    const isLandscape = mediaQuery("(orientation: landscape)");
    const orientation = $derived(isLandscape.matches ? "horizontal" : "vertical");
    const minGap = 1;
</script>

<main class="fill-page">
    <section class="control-screen">
        <div class="status card">
            <div>
                <p class="state-indicator" data-state={self.ossmInterface.state} data-text={self.ossmInterface.state[0].toUpperCase() + self.ossmInterface.state.slice(1)}>
                    <span class="material-symbol fill small" data-icon="circle"></span>
                </p>
            </div>
            <div>
                 <Button aria-label="Disconnect" icon="logout" onclick={self.onDisconnectClick} />
                 <Button class="stop-button" aria-label="Stop" icon="dangerous" onclick={self.onEmergencyStopClick} />
            </div>
        </div>

        <div
            class="options-and-controls"
            class:scale-pulse={self.ossmInterface.state === "reconnecting"}>
            <div class="options card">
                <div class="patterns-panel">
                    <div class="pattern-list">
                        <h3>Patterns</h3>
                        <div class="pattern-select">
                            {#each self.ossmInterface.patterns as pattern (pattern.idx)}
                                <RadioInput
                                    group="pattern"
                                    checked={self.selectedPattern === pattern.idx}
                                    onchange={() => (self.selectedPattern = pattern.idx)}
                                    disabled={self.disableControls}>
                                    {pattern.name}
                                </RadioInput>
                            {/each}
                        </div>
                    </div>
                    <div class="pattern-settings">
                        {#key self.selectedPattern}
                            <p class="description-text" transition:svelteFade={{ duration: 200, switching: true }}>{self.ossmInterface.patterns.find(p => p.idx === self.selectedPattern)?.description ?? ""}</p>
                        {/key}
                    </div>
                </div>
            </div>

            <div class="controls card">
                <!-- Range Control -->
                <div>
                    <NumericInput
                        disabled={self.disableControls}
                        spin="split"
                        spinOnly
                        min={self.controlRange.from + minGap}
                        max={100}
                        bind:value={self.controlRange.to}
                        onchange={(event: { value: number | null }) => { 
                            if (event.value !== null) {
                                self.onRangeChange({
                                    value: { from: self.controlRange.from, to: event.value },
                                    activeHandle: "to"
                                });
                            }
                        }}
                    />
                    <div class="glass-border">
                        <SliderDoubleInput
                            disabled={self.disableControls}
                            orientation={orientation}
                            min={0}
                            max={100}
                            minGap={minGap}
                            bind:from={self.controlRange.from}
                            bind:to={self.controlRange.to}
                            onchange={(event: RangeChangeEvent) => self.onRangeChange(event) }
                        />
                        <span class="material-symbol no-offset" data-icon="arrow_range"></span>
                    </div>
                    <NumericInput
                        disabled={self.disableControls}
                        spin="split"
                        spinOnly
                        min={0}
                        max={self.controlRange.to - minGap}
                        bind:value={self.controlRange.from}
                        onchange={(event: { value: number | null }) => { 
                            if (event.value !== null) {
                                self.onRangeChange({
                                    value: { from: event.value, to: self.controlRange.to },
                                    activeHandle: "from"
                                });
                            }
                        }}
                    />
                </div>

                <!-- Speed Control -->
                <div>
                    <div></div> <!-- Placeholder element to maintain the layout -->
                    <div class="glass-border">
                        <SliderInput
                            disabled={self.disableControls}
                            orientation={orientation}
                            min={0}
                            max={100}
                            bind:value={self.controlSpeed}
                            onchange={(event: { value: number }) => self.onSpeedChange(event.value) }
                        />
                        <span class="material-symbol no-offset" data-icon="speed"></span>
                    </div>
                    <NumericInput
                        disabled={self.disableControls}
                        spin="split"
                        spinOnly
                        min={0}
                        max={100}
                        bind:value={self.controlSpeed}
                        onchange={(event: { value: number | null }) => { if (event.value !== null) self.onSpeedChange(event.value); }}
                    />
                </div>

                <!-- Sensation Control -->
                {#if self.controlHasSensation}
                    <!-- TODO: Fade this element in and out (currently broken and snaps in/out when I try to use transition on it) -->
                    <div>
                        <CheckboxInput
                            class="invert-sensation {self.controlCanInvertSensation ? "" : "hidden"}"
                            disabled={self.disableControls}
                            checkedIcon="flip"
                            uncheckedIcon="flip"
                            bind:checked={self.controlInvertSensation}
                        />
                        <div class="glass-border">
                            <SliderInput
                                disabled={self.disableControls}
                                orientation={orientation}
                                min={0}
                                max={100}
                                bind:value={self.controlSensation}
                                onchange={(event: { value: number }) => self.onSensationChange(event.value) }
                            />
                            <span class="material-symbol no-offset" data-icon="nest_true_radiant"></span>
                        </div>
                        <NumericInput
                            disabled={self.disableControls}
                            spin="split"
                            spinOnly
                            min={0}
                            max={100}
                            bind:value={self.controlSensation}
                            onchange={(event: { value: number | null }) => { if (event.value !== null) self.onSensationChange(event.value); }}
                        />
                    </div>
                {/if}
            </div>
        </div>
    </section>
</main>
