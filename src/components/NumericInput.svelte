<script lang="ts">
    import type { HTMLInputAttributes } from 'svelte/elements';

    export type SpinDirection = 'left' | 'right' | 'split' | 'none';

    // Extend native input attributes, overriding value for number | null
    interface Props extends Omit<HTMLInputAttributes, 'value'> {
        value?: number | null;
        spin?: SpinDirection;
        placeholder?: string;
        min?: number;
        max?: number;
        step?: number;
        disabled?: boolean;
    }

    let {
        value = $bindable(undefined),
        spin = 'none',
        placeholder = '',
        min,
        max,
        step = 1,
        disabled = false,
        class: className = '',
        ...restProps
    }: Props = $props();

    function clamp(val: number): number {
        let clamped = val;
        if (min !== undefined) clamped = Math.max(min, clamped);
        if (max !== undefined) clamped = Math.min(max, clamped);
        return clamped;
    }

    function handleManualInput() {
        if (value === null || value === undefined || isNaN(value)) {
            value = undefined;
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

<div class="input-container-number {className}" data-spin={spin}>
    {#if spin !== 'none'}
        <button
            type="button"
            class="btn-minus"
            onclick={decrement}
            {disabled}
            class:limit-reached={min !== undefined && (value ?? 0) <= min}
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
        {...restProps}
    />

    {#if spin !== 'none'}
        <button
            type="button"
            class="btn-plus"
            onclick={increment}
            {disabled}
            class:limit-reached={max !== undefined && (value ?? 0) >= max}
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
                pointer-events: none;
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