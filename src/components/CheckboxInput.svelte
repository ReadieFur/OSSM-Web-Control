<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLInputAttributes } from 'svelte/elements';

    export type LabelPosition = 'left' | 'right';

    interface Props extends Omit<HTMLInputAttributes, 'type' | 'checked'> {
        checked?: boolean;
        children?: Snippet;
        labelPosition?: LabelPosition;
        checkedIcon?: string;
        uncheckedIcon?: string;
    }

    let {
        checked = $bindable(false),
        children,
        labelPosition = 'right',
        checkedIcon,
        uncheckedIcon,
        id,
        class: className = '',
        ...restProps
    }: Props = $props();

    const inputId = $derived(id ?? `cb-${Math.random().toString(36).substring(2, 9)}`);
    const hasIcons = $derived(Boolean(checkedIcon || uncheckedIcon));
    const isLabelFirst = $derived(labelPosition === 'left');
</script>

<!-- <div> -->
    <input
        type="checkbox"
        id={inputId}
        bind:checked={checked}
        class="{className}"
        class:after-label={isLabelFirst}
        class:icon={hasIcons}
        data-checked-icon={checkedIcon}
        data-unchecked-icon={uncheckedIcon}
        {...restProps}
    />
    
    {#if children}
        <label for={inputId}>
            {@render children()}
        </label>
    {/if}
<!-- </div> -->
