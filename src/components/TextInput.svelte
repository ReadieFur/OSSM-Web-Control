<script lang="ts">
    import type { HTMLInputAttributes } from 'svelte/elements';

    export type TextInputType = 'text' | 'password' | 'email' | 'search' | 'tel' | 'url';

    interface Props extends Omit<HTMLInputAttributes, 'type' | 'value'> {
        value?: string;
        type?: TextInputType;
    }

    let {
        value = $bindable(''),
        type = 'text',
        ...restProps
    }: Props = $props();
</script>

<input
    {type}
    bind:value={value}
    {...restProps}
/>
