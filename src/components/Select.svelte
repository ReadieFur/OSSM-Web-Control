<script lang="ts">
    import type { Snippet } from "svelte";
    import type { HTMLSelectAttributes } from "svelte/elements";

    interface Props extends HTMLSelectAttributes {
        value?: string | number | string[];
        icon?: string;
        iconPosition?: "left" | "right";
        children?: Snippet;
    }

    let {
        value = $bindable(),
        icon = "keyboard_arrow_down",
        iconPosition = "right",
        children,
        class: className = "",
        ...restProps
    }: Props = $props();
</script>

<div class="select-container {className}">
    {#if icon && iconPosition === "left"}
        <span class="material-symbol" data-icon={icon}></span>
    {/if}
    
    <select {...restProps}>
        {#if children}
            {@render children()}
        {/if}
    </select>

    {#if icon && iconPosition === "right"}
        <span class="material-symbol" data-icon={icon}></span>
    {/if}
</div>
