<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';

    interface Props extends HTMLAttributes<HTMLDivElement> {
        from?: number;
        to?: number;
        min?: number;
        max?: number;
        step?: number | 'any';
        minGap?: number;
        orientation?: 'horizontal' | 'vertical';
        disabled?: boolean;
    }

    let {
        from = $bindable(0),
        to = $bindable(100),
        min = 0,
        max = 100,
        step = 1,
        minGap = 0,
        orientation = 'horizontal',
        disabled = false,
        class: className = '',
        style = '',
        ...restProps
    }: Props = $props();

    let fromInputRef = $state<HTMLInputElement | null>(null);
    let toInputRef = $state<HTMLInputElement | null>(null);
    let activeHandle = $state<'from' | 'to' | null>(null);

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

        if (orientation === 'vertical') {
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

        if (step !== 'any' && Number(step) > 0) {
            const numStep = Number(step);
            const steps = Math.round((computedValue - numMin) / numStep);
            computedValue = numMin + steps * numStep;
        }

        return Math.max(numMin, Math.min(numMax, computedValue));
    }

    function updateHandleValue(handle: 'from' | 'to', event: PointerEvent, ref: HTMLInputElement) {
        const rawVal = calculateValueFromPointer(event, ref);

        if (handle === 'from') {
            const maxAllowed = to - minGap;
            from = Math.min(rawVal, maxAllowed);
        } else {
            const minAllowed = from + minGap;
            to = Math.max(rawVal, minAllowed);
        }
    }

    // Pointer handlers
    function handlePointerDown(handle: 'from' | 'to', event: PointerEvent) {
        const ref = handle === 'from' ? fromInputRef : toInputRef;
        if (!ref || disabled) return;

        event.preventDefault();
        ref.setPointerCapture(event.pointerId);
        activeHandle = handle;
        updateHandleValue(handle, event, ref);
    }

    function handlePointerMove(handle: 'from' | 'to', event: PointerEvent) {
        const ref = handle === 'from' ? fromInputRef : toInputRef;
        if (activeHandle !== handle || !ref || disabled) return;

        updateHandleValue(handle, event, ref);
    }

    function handlePointerUp(handle: 'from' | 'to', event: PointerEvent) {
        const ref = handle === 'from' ? fromInputRef : toInputRef;
        if (activeHandle !== handle || !ref) return;

        activeHandle = null;
        try { ref.releasePointerCapture(event.pointerId); }
        catch { /* Pointer capture release safety guard */ }

        if (!disabled)
            updateHandleValue(handle, event, ref);
    }

    function handlePointerCancel() {
        activeHandle = null;
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
</script>

<div
    class="input-container-range-double {className}"
    data-orientation={orientation}
    style="--range-from-value: {fromPercent}%; --range-to-value: {toPercent}%; {style}"
    {...restProps}
>
    <input
        bind:this={fromInputRef}
        type="range"
        data-component="from"
        value={from}
        {min}
        {max}
        {step}
        {disabled}
        oninput={onFromSliderInput}
        onpointerdown={(e) => handlePointerDown('from', e)}
        onpointermove={(e) => handlePointerMove('from', e)}
        onpointerup={(e) => handlePointerUp('from', e)}
        onpointercancel={handlePointerCancel}
        {...restProps}
    />
    <input
        bind:this={toInputRef}
        type="range"
        data-component="to"
        value={to}
        {min}
        {max}
        {step}
        {disabled}
        oninput={onToSliderInput}
        onpointerdown={(e) => handlePointerDown('to', e)}
        onpointermove={(e) => handlePointerMove('to', e)}
        onpointerup={(e) => handlePointerUp('to', e)}
        onpointercancel={handlePointerCancel}
        {...restProps}
    />
</div>

<style lang="scss">
.input-container-range-double {
    // Set in script
    --range-from-value: 20%;
    --range-to-value: 80%;

    // TODO: Make this more transparent without getting "muddy"
    $track-background: hsl(from $surface-2 h s l / 0.5);
    $track-fill: hsl(from $accent-1 h s l / 0.5);

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
                            $track-background 0%,
                            $track-background var(--range-from-value),
                            $track-fill var(--range-from-value),
                            $track-fill var(--range-to-value),
                            $track-background var(--range-to-value),
                            $track-background 100%
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
                            $track-background 0%,
                            $track-background var(--range-from-value),
                            $track-fill var(--range-from-value),
                            $track-fill var(--range-to-value),
                            $track-background var(--range-to-value),
                            $track-background 100%
                        ) center / var(--range-track-thickness) 100% no-repeat;
                }
            }
        }
    }
}
</style>
