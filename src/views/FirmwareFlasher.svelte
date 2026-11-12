<script lang="ts">
    import { FirmwareFlasher, type FirmwareFlasherProps } from "./FirmwareFlasher.svelte.ts";

    let props: FirmwareFlasherProps = $props();
    const self = new FirmwareFlasher(() => props);
</script>

<main>
    <section class="card">
        <!-- title -->
        <!-- console output box -->
        <!-- firmware selection -->
        <!-- action buttons -->
    </section>
</main>
