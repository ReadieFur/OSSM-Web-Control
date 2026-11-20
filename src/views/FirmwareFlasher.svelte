<script lang="ts">
    import { FirmwareFlasher, type FirmwareFlasherProps } from "./FirmwareFlasher.svelte.ts";
    import "./FirmwareFlasher.scss";
	import Button from "$component/Button.svelte";
	import CheckboxInput from "$component/CheckboxInput.svelte";
	import SliderInput from "$component/SliderInput.svelte";
	import Select from "$component/Select.svelte";

    let props: FirmwareFlasherProps = $props();
    const self = new FirmwareFlasher(() => props);
    const selectedManifest = $derived(self.firmwaresManifest.get(self.selectedFirmware));
    function shortHash(value: string) { return value.slice(0, 7); }
</script>

<main>
    <section class="firmware-flasher-wrapper card">
        <div class="header-bar">
            <h1>Firmware Flasher</h1>
            <div>
                <!-- Download logs button here? -->
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
        <div class="firmware-options">
            <div>
                <div>
                    <label for="firmware-select">Firmware</label>
                    <Select id="firmware-select" bind:value={self.selectedFirmware}>
                        {#each self.firmwaresManifest as [key, manifest] (key)}
                            <option value="{key}">
                                {manifest.source.repo.replace(/[-_]/g, ' ')}
                                <!-- <small>by {manifest.source.author}</small> -->
                            </option>
                        {/each}
                    </Select>
                    {#if self.firmwaresManifest.has(self.selectedFirmware)}
                        <Button
                            class="save_files"
                            icon="file_save"
                            title="Save firmware binaries & checksums"
                            onclick={self.onSaveFilesButtonClicked.bind(self)}/>
                    {/if}
                </div>
                <div>
                    <CheckboxInput
                        bind:checked={self.eraseFlash}
                        labelPosition="right">
                        Erase Flash
                    </CheckboxInput>
                    <Button
                        icon="developer_board"
                        onclick={self.onFlashButtonClicked.bind(self)}>
                        Upload
                    </Button>
                </div>
            </div>
            <div>
                <p>Author:
                    {#if selectedManifest}
                        <a
                            href="https://github.com/{selectedManifest.source.author}"
                            rel="noopener noreferrer external"
                            target="_blank">
                            {selectedManifest.source.author}
                        </a>
                    {:else}
                        <span class="na">N/A</span>
                    {/if}
                </p>
                <p>Tag:
                    {#if selectedManifest?.source.tag}
                        <a
                            href="https://github.com/{selectedManifest.source.author}/{selectedManifest.source.repo}/tree/{selectedManifest.source.tag}"
                            title={selectedManifest.source.tag}
                            rel="noopener noreferrer external"
                            target="_blank">
                            {shortHash(selectedManifest.source.tag)}
                        </a>
                    {:else}
                        <span>latest</span>
                    {/if}
                </p>
                <p>Repo:
                    {#if selectedManifest}
                        <a
                            href="https://github.com/{selectedManifest.source.author}/{selectedManifest.source.repo}"
                            rel="noopener noreferrer external"
                            target="_blank">
                            {selectedManifest.source.repo}
                        </a>
                    {:else}
                        <span class="na">N/A</span>
                    {/if}
                </p>
                <p>Build:
                    {#if selectedManifest && self.firmwaresBuildJob}
                        <a
                            href="{self.firmwaresBuildJob}"
                            rel="noopener noreferrer external"
                            target="_blank">
                            {selectedManifest?.source.pioEnv ?? 'N/A'}
                        </a>
                    {:else}
                        <span class:na={!selectedManifest?.source.pioEnv}>{selectedManifest?.source.pioEnv ?? 'N/A'}</span>
                    {/if}
                </p>
            </div>
        </div>
    </section>
</main>
