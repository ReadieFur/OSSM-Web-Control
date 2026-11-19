<script lang="ts">
    import type { Snippet } from "svelte";
    import type { HTMLButtonAttributes } from "svelte/elements";

    interface Props extends HTMLButtonAttributes {
        icon?: string;
        iconPosition?: "left" | "right";
        children?: Snippet;
    }

    let {
        icon,
        iconPosition = "left",
        children,
        class: className = "",
        ...restProps
    }: Props = $props();
</script>

<button class={className} {...restProps}>
    {#if !children}
        {#if icon}
            <span class="material-symbol" data-icon-position="both" data-icon={icon}></span>
        {/if}
    {:else}
        {#if icon && iconPosition === "left"}
            <span class="material-symbol" data-icon-position={iconPosition} data-icon={icon}></span>
        {/if}
        {@render children()}
        {#if icon && iconPosition === "right"}
            <span class="material-symbol" data-icon-position={iconPosition} data-icon={icon}></span>
        {/if}
    {/if}
</button>
