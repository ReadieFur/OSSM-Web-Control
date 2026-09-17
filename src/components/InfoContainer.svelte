<script lang="ts">
    import type { Snippet } from 'svelte';

    export type InfoContainerState = 'info' | 'success' | 'warning' | 'error' | string;

    interface Props {
        state?: InfoContainerState;
        title?: string;
        message?: string;
        extraContent?: string | Snippet;
        children?: Snippet;
    }

    let { state, title, message, extraContent, children }: Props = $props();
</script>

<div class="info-container" data-state={state}>
    {#if title}
        <p><strong>{title}</strong></p>
    {/if}

    {#if message}
        <p>{message}</p>
    {/if}

    {#if typeof extraContent === 'string'}
        <span>{extraContent}</span>
    {:else if extraContent}
        {@render extraContent()}
    {/if}

    {#if children}
        {@render children()}
    {/if}
</div>

<style lang="scss">
.info-container {
    // Container styling
    border: none;
    border-radius: $radius-600;
    border-left: calc($radius-600 - 1px) solid hsl(from $text-1 h s l / 0.7);
    background-color: hsl(from $surface-2 h s l / 0.5);

    // Content layout
    display: flex;
    flex-direction: column;
    text-align: center;
    gap: 1rem;
    padding: 1rem;

    // State-based styling
    $states: (
        success: $green,
        error:   $red,
        warning: $yellow
    );
    @each $state, $color in $states {
        &[data-state="#{$state}"] {
            border-left-color: hsl(from $color h s l / 0.8);
            background: hsl(from $color h s l / 0.05);

            &::before {
                //h2
                font-size: 1.5rem;
                font-weight: bold;
            }
        }
    }

    &[data-state="success"]::before {
        content: "✅ Success!";
    }

    &[data-state="error"]::before {
        content: "❌ Error!";
    }

    &[data-state="warning"]::before {
        content: "⚠️ Warning!";
    }
}
</style>
