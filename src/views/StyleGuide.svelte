<script lang="ts">
	import TextInput from "$component/TextInput.svelte";
	import NumericInput from "$component/NumericInput.svelte";
	import SliderDoubleInput from "../components/SliderDoubleInput.svelte";
	import SliderInput from "../components/SliderInput.svelte";
	import CheckboxInput from "../components/CheckboxInput.svelte";
	import RadioInput from "../components/RadioInput.svelte";
	import InfoContainer from "../components/InfoContainer.svelte";
	import Button from "../components/Button.svelte";

    import type { ViewManagerProps } from '$lib/state/viewManager.svelte.ts';

    let { viewManager }: ViewManagerProps = $props();
</script>

<main class="style-guide">
    <div>
        <h2>Buttons</h2>

        <Button>Button</Button>
        <Button icon="circle"><small>(button with icon)</small></Button>
    </div>

    <div>
        <h2>Inputs</h2>
        <TextInput placeholder="Text input" />
        <TextInput type="password" placeholder="Password input" />

        <NumericInput placeholder="Number input" />
        <NumericInput spin="left" placeholder="Number input (spin-left)" />
        <NumericInput spin="right" placeholder="Number input (spin-right)" />
        <NumericInput spin="split" placeholder="Number input (spin-split)" min="0" max="10" />
    </div>

    <div>
        <h3>Checkboxes</h3>
        <CheckboxInput>Checkbox</CheckboxInput>
        <CheckboxInput checked>Checkbox <small>(checked)</small></CheckboxInput>
        <CheckboxInput labelPosition="left">Checkbox <small>(inverted)</small></CheckboxInput>
        <CheckboxInput labelPosition="left" checked>Checkbox <small>(checked inverted)</small></CheckboxInput>
        <CheckboxInput checkedIcon="circle" uncheckedIcon="circle" checked style="font-size: 1.5rem;"/>
    </div>

    <div>
        <h3>Radio buttons</h3>
        <RadioInput group="rd-1">Radio</RadioInput>
        <RadioInput group="rd-1" checked>Radio <small>(selected)</small></RadioInput>
        <RadioInput group="rd-2" labelPosition="left">Radio <small>(inverted)</small></RadioInput>
        <RadioInput group="rd-2" labelPosition="left" checked>Radio <small>(selected inverted)</small></RadioInput>
    </div>

    <div>
        <h3>Sliders</h3>
        <SliderInput min={0} max={100} value={25}/>
        <SliderInput orientation="vertical" min={0} max={100} value={75}/>
        <SliderDoubleInput from={20} to={80}/>
        <SliderDoubleInput orientation="vertical" from={20} to={80} minGap={20}/>
    </div>

    <div>
        <div class="card">Card</div>
    </div>

    <div>
        <h2>Info Container</h2>
        <InfoContainer title="Title" message="Message" />
        <InfoContainer title="Title" message="Message" state="success" />
        <InfoContainer title="Title" state="error" />
        <InfoContainer message="Message" state="warning" />
    </div>

    <footer>
        <p>Made with ❤️ by ChloeDoe 🦌!</p>
    </footer>
</main>

<style lang="scss">
.style-guide {
    padding: 15px 20px;
    width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 5rem;

    .card {
        padding: 10px;
        min-width: 100px;
    }

    > div {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        width: fit-content;
    }

    > footer {
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        font-size: 0.75rem;
        margin-top: 1rem;
    }
}
</style>
