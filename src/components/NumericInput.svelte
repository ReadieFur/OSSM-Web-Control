<script lang="ts">
    export type SpinDirection = 'left' | 'right' | 'split' | 'none';

    interface Props {
        value?: number;
        spin?: SpinDirection;
        placeholder?: string;
        min?: number;
        max?: number;
        step?: number;
        disabled?: boolean;
    }

    let {
        value = $bindable(0),
        spin = 'none',
        placeholder = '',
        min,
        max,
        step = 1,
        disabled = false
    }: Props = $props();

    function clamp(val: number): number {
        let clamped = val;
        if (min !== undefined) clamped = Math.max(min, clamped);
        if (max !== undefined) clamped = Math.min(max, clamped);
        return clamped;
    }

    function handleManualInput() {
        if (value === undefined || isNaN(value)) {
            if (min !== undefined) value = min;
            return;
        }
        value = clamp(value);
    }

    function decrement() {
        if (disabled) return;
        const current = value ?? 0;
        value = clamp(current - step);
    }

    function increment() {
        if (disabled) return;
        const current = value ?? 0;
        value = clamp(current + step);
    }
</script>

<div class="input-container-number" data-spin={spin}>
    {#if spin !== 'none'}
        <button
            type="button"
            class="btn-minus"
            onclick={decrement}
            disabled={disabled}
            class:limit-reached={min !== undefined && value <= min}
        >
            -
        </button>
    {/if}

    <input
        type="number"
        bind:value={value}
        onchange={handleManualInput}
        {placeholder}
        {min}
        {max}
        {step}
        {disabled}
    />

    {#if spin !== 'none'}
        <button
            type="button"
            class="btn-plus"
            onclick={increment}
            disabled={disabled}
            class:limit-reached={max !== undefined && value >= max}
        >
            +
        </button>
    {/if}
</div>

<style lang="scss">
    .input-container-number {
        display: inline-flex;
        border-radius: $radius-400;
        overflow: hidden;

        [type="number"] {
            flex: 1;
            min-width: 0;
            appearance: textfield;
            border-radius: 0;

            &::-webkit-inner-spin-button,
            &::-webkit-outer-spin-button {
                -webkit-appearance: none;
            }
        }

        > button {
            padding: 0.2rem 0.5rem;
            border-radius: 0;

            &:not(:disabled).limit-reached {
                pointer-events: none; // Disable hover effect entirely
                color: $text-3;
            }
        }

        &[data-spin="split"] {
            .btn-minus { order: 1; }
            [type="number"] { order: 2; text-align: center; }
            .btn-plus { order: 3; }
        }

        &[data-spin="left"] {
            .btn-minus { order: 1; }
            .btn-plus { order: 2; }
            [type="number"] { order: 3; text-align: left; }
        }

        &[data-spin="right"] {
            [type="number"] { order: 1; text-align: right; }
            .btn-minus { order: 2; }
            .btn-plus { order: 3; }
        }
    }
</style>
