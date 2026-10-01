<script lang="ts">
	import { cubicOut } from "svelte/easing";
    import type { HTMLAttributes } from "svelte/elements";
	import { Tween } from "svelte/motion";

    export type InputHandle = "from" | "to";

    export type RangeValue = {
        [key in InputHandle]: number;
    };

    export type RangeChangeEvent = {
        value: RangeValue;
        activeHandle: InputHandle;
    };

    interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "onchange" | "ondrag"> {
        from?: number;
        to?: number;
        min?: number;
        max?: number;
        step?: number | "any";
        minGap?: number;
        orientation?: "horizontal" | "vertical";
        disabled?: boolean;
        dragUpdateInterval?: number,
        onchange?: (event: RangeChangeEvent) => void;
        ondrag?: (event: RangeChangeEvent) => void;
    }

    let {
        from = $bindable(0),
        to = $bindable(100),
        min = 0,
        max = 100,
        step = 1,
        minGap = 0,
        orientation = "horizontal",
        disabled = false,
        dragUpdateInterval = 1000,
        class: className = "",
        style = "",
        onchange,
        ondrag,
        ...restProps
    }: Props = $props();

    let fromInputRef = $state<HTMLInputElement | null>(null);
    let toInputRef = $state<HTMLInputElement | null>(null);
    let activeHandle = $state<InputHandle | null>(null);
    let pointerInteracting = $state(false);
    let lastDispatchedValue = $state<RangeValue>({ from: 0, to: 100 });

    let fromPercent = $derived.by(() => {
        const rangeDistance = max - min;
        if (rangeDistance <= 0) return 0;
        return ((from - min) / rangeDistance) * 100;
    });

    let toPercent = $derived.by(() => {
        const rangeDistance = max - min;
        if (rangeDistance <= 0) return 100;
        return ((to - min) / rangeDistance) * 100;
    });

    // WebKit input patches (other devices wouldn't otherwise require this)
    // See SliderInput.svelte for more details on this workaround (more comments in that file)
    function calculateValueFromPointer(event: PointerEvent, ref: HTMLInputElement): number {
        const rect = ref.getBoundingClientRect();
        let positionPercent: number;

        if (orientation === "vertical") {
            const offsetY = event.clientY - rect.top;
            positionPercent = 1 - (offsetY / rect.height);
        } else {
            const offsetX = event.clientX - rect.left;
            positionPercent = offsetX / rect.width;
        }

        positionPercent = Math.max(0, Math.min(1, positionPercent));

        const numMin = Number(min);
        const numMax = Number(max);
        let computedValue = numMin + positionPercent * (numMax - numMin);

        if (step !== "any" && Number(step) > 0) {
            const numStep = Number(step);
            const steps = Math.round((computedValue - numMin) / numStep);
            computedValue = numMin + steps * numStep;
        }

        return Math.max(numMin, Math.min(numMax, computedValue));
    }

    function updateHandleValue(handle: InputHandle, event: PointerEvent, ref: HTMLInputElement) {
        const rawVal = calculateValueFromPointer(event, ref);

        if (handle === "from") {
            const maxAllowed = to - minGap;
            from = Math.min(rawVal, maxAllowed);
        } else {
            const minAllowed = from + minGap;
            to = Math.max(rawVal, minAllowed);
        }
    }

    // Pointer handlers
    function handlePointerDown(handle: InputHandle, event: PointerEvent) {
        const ref = handle === "from" ? fromInputRef : toInputRef;
        if (!ref || disabled) return;

        event.preventDefault();
        ref.setPointerCapture(event.pointerId);
        activeHandle = handle;
        updateHandleValue(handle, event, ref);
        lastDispatchedValue = { from, to };
        // ondrag?.({ value: { from, to }, activeHandle });
    }

    function handlePointerMove(handle: InputHandle, event: PointerEvent) {
        const ref = handle === "from" ? fromInputRef : toInputRef;
        if (activeHandle !== handle || !ref || disabled) return;

        updateHandleValue(handle, event, ref);
    }

    function handlePointerUp(handle: InputHandle, event: PointerEvent) {
        const ref = handle === "from" ? fromInputRef : toInputRef;
        if (activeHandle !== handle || !ref) return;

        activeHandle = null;
        try { ref.releasePointerCapture(event.pointerId); }
        catch { /* Pointer capture release safety guard */ }

        if (disabled) return;

        updateHandleValue(handle, event, ref);
        pointerInteracting = true;
        onchange?.({
            value: { from, to },
            activeHandle: handle
        });
    }

    function handlePointerCancel() {
        activeHandle = null;
        pointerInteracting = false;
    }

    // Fallbacks for keyboard input and standard events
    function onFromSliderInput(event: Event & { currentTarget: HTMLInputElement }) {
        let val = Number(event.currentTarget.value);
        if (val > to - minGap) val = to - minGap;
        from = val;
    }

    function onToSliderInput(event: Event & { currentTarget: HTMLInputElement }) {
        let val = Number(event.currentTarget.value);
        if (val < from + minGap) val = from + minGap;
        to = val;
    }

    // For keyboard inputs
    function handleNativeChange(handle: InputHandle) {
        if (pointerInteracting) {
            pointerInteracting = false;
            return;
        }

        onchange?.({
            value: { from, to },
            activeHandle: handle
        });
    }

    // Periodic drag updates
    $effect(() => {
        if (!activeHandle || !dragUpdateInterval || !ondrag)
            return;

        const intervalId = setInterval(() => {
            if (activeHandle && (from !== lastDispatchedValue.from || to !== lastDispatchedValue.to)) {
                lastDispatchedValue = { from, to };
                ondrag({
                    value: { from, to },
                    activeHandle
                });
            }
        }, dragUpdateInterval);

        return () => clearInterval(intervalId);
    });

    const tweenDefaultDuration = 150;
    const animatedFromPercent = new Tween(0, { duration: tweenDefaultDuration, easing: cubicOut });
    const animatedToPercent = new Tween(0, { duration: tweenDefaultDuration, easing: cubicOut });
    $effect(() => { animatedFromPercent.set(fromPercent) });
    $effect(() => { animatedToPercent.set(toPercent) });
    const isAnimatingTo = $derived(Math.abs(animatedToPercent.current - animatedToPercent.target) > 0.01);
    const isAnimatingFrom = $derived(Math.abs(animatedFromPercent.current - animatedFromPercent.target) > 0.01);
</script>

<div
    class="input-container-range-double {className}"
    data-orientation={orientation}
    style="--range-from-value: {animatedFromPercent.current}%; --range-to-value: {animatedToPercent.current}%; {style}"
    {...restProps}
>
    <input
        bind:this={fromInputRef}
        class:is-animating-to={isAnimatingTo}
        class:is-animating-from={isAnimatingFrom}
        type="range"
        data-component="from"
        value={from}
        {min}
        {max}
        {step}
        {disabled}
        oninput={onFromSliderInput}
        onpointerdown={(e) => handlePointerDown("from", e)}
        onpointermove={(e) => handlePointerMove("from", e)}
        onpointerup={(e) => handlePointerUp("from", e)}
        onpointercancel={handlePointerCancel}
        onchange={() => handleNativeChange("from")}
        {...restProps}
    />
    <input
        bind:this={toInputRef}
        class:is-animating-to={isAnimatingTo}
        class:is-animating-from={isAnimatingFrom}
        type="range"
        data-component="to"
        value={to}
        {min}
        {max}
        {step}
        {disabled}
        oninput={onToSliderInput}
        onpointerdown={(e) => handlePointerDown("to", e)}
        onpointermove={(e) => handlePointerMove("to", e)}
        onpointerup={(e) => handlePointerUp("to", e)}
        onpointercancel={handlePointerCancel}
        onchange={() => handleNativeChange("to")}
        {...restProps}
    />
</div>

<style lang="scss">
.input-container-range-double {
    // Set in script
    --range-from-value: 20%;
    --range-to-value: 80%;

    --track-bg: #{hsl(from $surface-2 h s l / 0.5)};
    --track-fill-1: #{hsl(from $accent-1 h s l / 0.5)};
    --track-fill-2: #{hsl(from $accent-1 h s l / 0.5)};

    position: relative;
    display: inline-flex;
    flex-wrap: wrap;

    > input[type="range"] {
        position: relative;
        flex: 100%;

        &[data-component="from"] {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            z-index: 1;
        }
    }

    &:not([data-orientation="vertical"]) {
        > input[type="range"] {
            // Left side
            &[data-component="from"] {
                $offset: calc(100% - var(--range-to-value) + ((var(--range-to-value) - var(--range-from-value)) / 2));
                $handle-offset: 0;
                $left-offset: $offset; //These two would be flipped if direction was right-to-left
                $right-offset: 0;
                clip-path: inset($handle-offset $left-offset $handle-offset $right-offset);

                @include range-track {
                    background: transparent;
                }
            }

            // Right side
            &[data-component="to"]:not(:disabled) {
                @include range-track {
                    background:
                        linear-gradient(
                            to right,
                            var(--track-bg) 0%,
                            var(--track-bg) var(--range-from-value),
                            var(--track-fill-1) var(--range-from-value),
                            var(--track-fill-2) var(--range-to-value),
                            var(--track-bg) var(--range-to-value),
                            var(--track-bg) 100%
                        ) center / 100% var(--range-track-thickness) no-repeat;
                }
            }
        }
    }

    &[data-orientation="vertical"] {
        // width: fit-content;

        > input[type="range"] {
            @include range-vertical;

            @include range-thumb {
                @include ifWebKit {
                    width: var(--range-track-thickness);
                    height: 1rem;
                }
            }

            height: initial;

            // Bottom side
            &[data-component="from"] {
                $offset: calc(100% - var(--range-to-value) + ((var(--range-to-value) - var(--range-from-value)) / 2));
                $handle-offset: 0;
                $top-offset: 0; //These two would be flipped if direction was top-to-bottom
                $bottom-offset: $offset;
                clip-path: inset($bottom-offset $handle-offset $top-offset $handle-offset);

                @include range-track {
                    background: transparent;
                }
            }

            // Top side
            &[data-component="to"]:not(:disabled) {
                @include range-track {
                    background:
                        linear-gradient(
                            to top,
                            var(--track-bg) 0%,
                            var(--track-bg) var(--range-from-value),
                            var(--track-fill-1) var(--range-from-value),
                            var(--track-fill-2) var(--range-to-value),
                            var(--track-bg) var(--range-to-value),
                            var(--track-bg) 100%
                        ) center / var(--range-track-thickness) 100% no-repeat;
                }
            }
        }
    }
}
</style>
