<script lang="ts">
    import Button from '$component/Button.svelte';
	import RadioInput from '$component/RadioInput.svelte';
	import SliderDoubleInput from '$component/SliderDoubleInput.svelte';
	import SliderInput from '$component/SliderInput.svelte';
	import NumericInput from '$component/NumericInput.svelte';
	import CheckboxInput from '$component/CheckboxInput.svelte';
    import './MainControlView.scss'
</script>

<main class="fill-page">
    <section class="control-screen">
        <div class="status card">
            <div>
                <p class="state-indicator" data-state="not-ready" data-text="Disconnected">
                    <span class="material-symbol fill small" data-icon="circle"></span>
                </p>
            </div>
            <div>
                <!-- TODO: Future feature; session sharing -->
                 <Button aria-label="Reset settings" icon="reset_settings" />
                 <Button aria-label="Disconnect" icon="logout" />
                 <Button class="stop-button" aria-label="Stop" icon="dangerous" />
            </div>
        </div>

        <div class="options-and-controls">
            <div class="options card">
                <div class="patterns-panel">
                    <div class="pattern-list">
                        <h3>Patterns</h3>
                        <div class="pattern-select">
                            <RadioInput group="pattern" id="pattern-0" checked>Pattern 1</RadioInput>
                            <RadioInput group="pattern" id="pattern-1">Pattern 2</RadioInput>
                            <RadioInput group="pattern" id="pattern-2">Pattern 3</RadioInput>
                        </div>
                    </div>
                    <div class="pattern-settings">
                        <p class="description-text">[Description] Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
                    </div>
                </div>
            </div>

            <div class="controls card">
                <div>
                    <NumericInput spin="split" />
                    <div class="glass-border">
                        <SliderDoubleInput orientation="vertical" />
                        <span class="material-symbol no-offset" data-icon="arrow_range"></span>
                    </div>
                    <NumericInput spin="split" />
                </div>
                <div>
                    <div></div>
                    <div class="glass-border">
                        <SliderInput orientation="vertical" />
                        <span class="material-symbol no-offset" data-icon="speed"></span>
                    </div>
                    <NumericInput spin="split" />
                </div>
                <div>
                    <CheckboxInput class="invert-intensity" checkedIcon="flip" uncheckedIcon="flip" />
                    <div class="glass-border">
                        <SliderInput orientation="vertical" />
                        <span class="material-symbol no-offset" data-icon="nest_true_radiant"></span>
                    </div>
                    <NumericInput spin="split" />
                </div>
            </div>
        </div>
    </section>
</main>
