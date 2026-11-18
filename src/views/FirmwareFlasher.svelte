<script lang="ts">
    import { FirmwareFlasher, type FirmwareFlasherProps } from "./FirmwareFlasher.svelte.ts";
    import "./FirmwareFlasher.scss";
	import Button from "$component/Button.svelte";
	import CheckboxInput from "$component/CheckboxInput.svelte";

    let props: FirmwareFlasherProps = $props();
    const self = new FirmwareFlasher(() => props);
</script>

<main>
    <section class="firmware-flasher-wrapper card">
        <div class="header-bar">
            <h1>Firmware Flasher</h1>
            <div>
                <Button
                    class="exit-button"
                    icon="close"
                    onclick={self.exit.bind(self)}/>
            </div>
        </div>
        <div class="console-output">
            {#each self.terminalOutput as [id, line] (id)}
                <pre class="code"><code>{line}</code></pre>
            {/each}
        </div>
        <div>
            <label for="firmware-select">Firmware</label>
            <select id="firmware-select" bind:value={self.selectedFirmware}>
                {#each self.firmwaresManifest as [key, manifest] (key)}
                <option value="{key}">
                    {manifest.source.repo.replace(/[-_]/g, ' ')}
                    <!-- <small>by {manifest.source.author}</small> -->
                </option>
                {/each}
            </select>
            <CheckboxInput
                bind:checked={self.eraseFlash}
                labelPosition="left">
                Erase Flash
            </CheckboxInput>
            <!-- <Button
                class={self.eraseFlash ? 'checked' : ''}
                onclick={() => self.eraseFlash = !self.eraseFlash}>
                Erase Flash
            </Button> -->
            <Button
                icon="developer_board"
                onclick={self.onFlashButtonClicked.bind(self)}>
                Flash
            </Button>
        </div>
        <!-- firmware selection -->
        <!-- action buttons -->
    </section>
</main>
