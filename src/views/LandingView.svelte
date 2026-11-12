<script lang="ts">
    import { LandingView, type LandingViewProps } from "./LandingView.svelte.ts";
    import InfoContainer from "$component/InfoContainer.svelte";
    import { svelteFade } from "$lib/utils/Animation.svelte";
	import Button from "$component/Button.svelte";

    let props: LandingViewProps = $props();
    const self = new LandingView(() => props);

    const noPulse = $derived(self.discoveredBleProviders !== undefined);
</script>

<main>
    <section
        class="landing-view card"
        class:scale-pulse={self.isConnecting && !noPulse}>
        <h1>OSSM Web Control</h1>

        {#if self.isSecureContext}
            {#if self.isBleSupported}
                <Button
                    class="space-between"
                    iconPosition="left"
                    icon="bluetooth_searching"
                    disabled={self.isConnecting}
                    onclick={self.connectBleDevice.bind(self)}>
                    Connect OSSM
                </Button>
            {:else}
                <InfoContainer
                    state="error"
                    title="Unsupported Browser"
                    message="Your browser does not support the required Bluetooth features">
                    {#if self.platform === "Windows" || self.platform === "Linux" || self.platform === "Macintosh" || self.platform === "Android"}
                        <p><small>Please use a compatible browser such as Chrome</small></p>
                    {:else if self.platform === "iOS"}
                        <p>
                            <small>
                                iOS devices must use the Bluefy browser
                                <a
                                    href="https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055"
                                    target="_blank"
                                    rel="noopener noreferrer">(App Store)
                                </a>
                            </small>
                        </p>
                    {:else}
                        <!-- Fallback for unknown platforms -->
                        <p><small>Please ensure your browser and device have bluetooth capabilities</small></p>
                    {/if}
                </InfoContainer>
            {/if}

            {#if self.showInstallButton}
                <button
                    class="space-between"
                    disabled={self.isPwaInstalling}
                    onclick={self.installPWA.bind(self)}
                    out:svelteFade>
                    <span class="material-symbol" data-icon="deployed_code_update"></span>Install PWA
                </button>
            {/if}

            {#if self.isFlasherSupported}
                <Button
                    class="space-between"
                    disabled={self.isConnecting}
                    onclick={self.flashFirmware.bind(self)}>
                    <span class="material-symbol" data-icon="usb"></span>Flash Firmware
                </Button>
            {/if}

        {:else}
            <InfoContainer
                state="error"
                title="Insecure Context"
                message="This application requires a secure context (HTTPS)"
            />
        {/if}

        {#if self.infoDialog}
            <InfoContainer
                state={self.infoDialog.state}
                title={self.infoDialog.title}
                message={self.infoDialog.message}>
                <small><i style="white-space: pre-wrap;">{self.infoDialog.extra}</i></small>
            </InfoContainer>
        {/if}

        {#if self.discoveredBleProviders !== undefined}
            {#each self.discoveredBleProviders.providers as provider (provider.friendlyName)}
                <Button
                    class="space-between"
                    iconPosition="left"
                    icon="terminal_2"
                    disabled={!self.isConnecting}
                    onclick={() => {self.discoveredBleProviders?.solver.resolve(provider)}}>
                    {provider.friendlyName}
                </Button>
            {/each}
            <Button
                class="space-between"
                iconPosition="left"
                icon="close"
                disabled={!self.isConnecting}
                onclick={() => {self.discoveredBleProviders?.solver.reject(new DOMException("User cancelled the operation", "NotFoundError"))}}>
                Cancel
            </Button>
        {/if}
    </section>
</main>

<style lang="scss">
.landing-view {
    user-select: none;
}
</style>
