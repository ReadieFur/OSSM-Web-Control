<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLButtonAttributes } from 'svelte/elements';

    export type IconPosition = 'left' | 'right';

    interface Props extends HTMLButtonAttributes {
        icon?: string;
        iconPosition?: IconPosition;
        children?: Snippet;
    }

    let {
        icon,
        iconPosition = 'left',
        children,
        class: className = '',
        ...restProps
    }: Props = $props();
</script>

<button class={className} {...restProps}>
    {#if icon && iconPosition === 'left'}
        <span class="material-symbol" data-icon={icon}></span>
    {/if}
    {#if children}
        {@render children()}
    {/if}
    {#if icon && iconPosition === 'right'}
        <span class="material-symbol" data-icon={icon}></span>
    {/if}
</button>
