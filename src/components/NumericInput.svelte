<script lang="ts">
    import type { HTMLInputAttributes } from 'svelte/elements';

    interface Props extends Omit<HTMLInputAttributes, 'value'> {
        value?: number | null;
        spin?: 'left' | 'right' | 'split' | 'none';
        spinOnly?: boolean;
        placeholder?: string;
        min?: number;
        max?: number;
        step?: number;
        disabled?: boolean;
    }

    let {
        value = $bindable(undefined),
        spin = 'none',
        spinOnly = false,
        placeholder = '',
        min,
        max,
        step = 1,
        disabled = false,
        class: className = '',
        ...restProps
    }: Props = $props();

    // Draft state for uncommitted typing
    let draft = $state<string | null>(null);

    const displayValue = $derived(draft ?? value ?? '');
    const isReadOnly = $derived(spinOnly && spin !== 'none');

    function clamp(val: number): number {
        let clamped = val;
        if (min !== undefined) clamped = Math.max(min, clamped);
        if (max !== undefined) clamped = Math.min(max, clamped);
        return clamped;
    }

    function commitValue(val: string | number | undefined) {
        if (val === '' || val === null || val === undefined || isNaN(Number(val)))
            value = undefined;
        else
            value = clamp(Number(val));
        draft = null;
    }

    function handleInput(e: Event & { currentTarget: HTMLInputElement }) {
        draft = e.currentTarget.value;
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter')
            commitValue(displayValue);
    }

    function handleBlur() {
        if (draft !== null)
            commitValue(draft);
    }

    function decrement() {
        if (disabled) return;
        draft = null;
        const current = value ?? 0;
        value = clamp(current - step);
    }

    function increment() {
        if (disabled) return;
        draft = null;
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
        value={displayValue}
        oninput={handleInput}
        onkeydown={handleKeyDown}
        onblur={handleBlur}
        readonly={isReadOnly}
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
