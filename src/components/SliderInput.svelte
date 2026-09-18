<script lang="ts">
    import type { HTMLInputAttributes } from 'svelte/elements';

    export type SliderOrientation = 'horizontal' | 'vertical';

    interface Props extends Omit<HTMLInputAttributes, 'value' | 'type'> {
        value?: number;
        min?: number;
        max?: number;
        step?: number | 'any';
        orientation?: SliderOrientation;
    }

    let {
        value = $bindable(0),
        min = 0,
        max = 100,
        step = 1,
        orientation = 'horizontal',
        class: className = '',
        style = '',
        ...restProps
    }: Props = $props();

    let inputRef = $state<HTMLInputElement | null>(null);
    let isDragging = $state(false);

    // Dynamic track fill percentage for CSS --range-value
    let percent = $derived.by(() => {
        const numMin = Number(min);
        const numMax = Number(max);
        if (numMax <= numMin) return 0;
        const current = value ?? numMin;
        const clamped = Math.max(numMin, Math.min(numMax, current));
        return ((clamped - numMin) / (numMax - numMin)) * 100;
    });

    // This is a workaround for WebKit browsers where clicking and dragging on the track of a range input does not move the thumb.
    function calculateValueFromPointer(event: PointerEvent): number {
        if (!inputRef) return value ?? Number(min);

        const rect = inputRef.getBoundingClientRect();
        let positionPercent: number;

        if (orientation === 'vertical') {
            const offsetY = event.clientY - rect.top;
            positionPercent = 1 - (offsetY / rect.height); // Invert due to CSS using rtl/v-lr to flip the input for vertical orientation. 
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

    function handlePointerDown(event: PointerEvent) {
        if (!inputRef) return;
        event.preventDefault(); // Prevent default single-snapping.
        inputRef.setPointerCapture(event.pointerId); // Capture pointer to continue receiving events even if the pointer goes outside the element (required for the release to work properly).
        isDragging = true;
        value = calculateValueFromPointer(event);
    }

    function handlePointerMove(event: PointerEvent) {
        if (!isDragging) return;
        value = calculateValueFromPointer(event);
    }

    function handlePointerUp(event: PointerEvent) {
        if (!isDragging || !inputRef) return;
        isDragging = false;
        try { inputRef.releasePointerCapture(event.pointerId); }
        catch { /* Pointer capture release safety guard */ }
        value = calculateValueFromPointer(event);
    }

    function handlePointerCancel() {
        isDragging = false;
    }
</script>

<input
    bind:this={inputRef}
    type="range"
    bind:value={value}
    {min}
    {max}
    {step}
    data-orientation={orientation}
    class="input-range {className}"
    style="--range-value: {percent}%; {style}"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerCancel}
    {...restProps}
/>
