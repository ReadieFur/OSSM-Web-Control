<script>
	import NumericInput from "$component/NumericInput.svelte";
	import SliderDoubleInput from "../components/SliderDoubleInput.svelte";
	import SliderInput from "../components/SliderInput.svelte";
</script>

<main class="style-guide">
    <div>
        <h2>Buttons</h2>

        <button>Regular</button>

        <button class="no-border">No Border</button>
        <button>
            <span>
                <span>With</span>
                <p>Content</p>
            </span>
        </button>
    </div>

    <div>
        <h2>Inputs</h2>
        <input type="text" placeholder="Text input">

        <input type="password" placeholder="Password input">

        <NumericInput placeholder="Number input" />
        <NumericInput spin="left" placeholder="Number input (spin-left)" />
        <NumericInput spin="right" placeholder="Number input (spin-right)" />
        <NumericInput spin="split" placeholder="Number input (spin-split)" min="0" max="10" />
    </div>

    <div>
        <h3>Checkboxes</h3>
        <input type="checkbox" id="checkbox1">
        <label for="checkbox1">Checkbox</label>
        <input type="checkbox" id="checkbox2" checked>
        <label for="checkbox2">Checkbox <small>(checked)</small></label>
        <input type="checkbox" id="checkbox3" class="after-label">
        <label for="checkbox3">Checkbox <small>(right)</small></label>
        <input type="checkbox" id="checkbox4" class="after-label" checked>
        <label for="checkbox4">Checkbox <small>(checked right)</small></label>
        <input type="checkbox" id="checkbox5" checked>
        <input type="checkbox" id="checkbox6" class="icon" data-checked-icon="circle" data-unchecked-icon="circle" checked style="font-size: 1.5rem;">
    </div>

    <div>
        <h3>Radio buttons</h3>
        <input type="radio" id="radio1" name="radio-group">
        <label for="radio1">Radio</label>
        <input type="radio" id="radio2" name="radio-group" checked>
        <label for="radio2">Radio <small>(selected)</small></label>
        <input type="radio" id="radio3" class="after-label" name="radio-group-2">
        <label for="radio3">Radio <small>(right)</small></label>
        <input type="radio" id="radio4" class="after-label" name="radio-group-2" checked>
        <label for="radio4">Radio <small>(selected right)</small></label>
    </div>

    <div>
        <h3>Sliders</h3>
        <SliderInput min={0} max={100} value={25}/>
        <SliderInput orientation="vertical" min={0} max={100} value={75}/>
        <SliderDoubleInput from={20} to={80}/>
        <SliderDoubleInput orientation="vertical" from={20} to={80}/>
    </div>

    <div>
        <div class="card">Card</div>
    </div>

    <div>
        <h2>Info Container</h2>
        <div class="info-container" data-state="">
            <p><strong>Title</strong></p>
            <p>Message</p>
        </div>
        <div class="info-container" data-state="success">
            <p><strong>Title</strong></p>
            <p>Message</p>
        </div>
        <div class="info-container" data-state="error">
            <p><strong>Title</strong></p>
            <p>Message</p>
        </div>
        <div class="info-container" data-state="warning">
            <p><strong>Title</strong></p>
            <p>Message</p>
        </div>
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
