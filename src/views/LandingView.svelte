<script lang="ts">
    import { LandingView } from './LandingView.svelte.ts';
    import InfoContainer from '$component/InfoContainer.svelte';
    import { svelteFade } from '$lib/utils/animation.ts';

    const self = new LandingView();
</script>

<main>
    <section
        class="card"
        class:scale-pulse={self.connector.state === 'connecting'}>
        <h1>OSSM Web Control</h1>

        {#if self.isSecureContext}
            {#if self.isBleSupported}
                <button
                    class="space-between"
                    disabled={self.connector.state === 'connecting'}
                    onclick={self.connectDevice.bind(self)}>
                    <span class="material-symbol" data-icon="bluetooth_searching"></span>Connect OSSM
                </button>
            {:else}
                <InfoContainer
                    state="error"
                    title="Unsupported Browser"
                    message="Your browser does not support the required Bluetooth features"
                >
                    {#if self.platform === 'Windows' || self.platform === 'Linux' || self.platform === 'Macintosh' || self.platform === 'Android'}
                        <p><small>Please use a compatible browser such as Chrome</small></p>
                    {:else if self.platform === 'iOS'}
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
                    transition:svelteFade>
                    <span class="material-symbol" data-icon="deployed_code_update"></span>Install PWA
                </button>
            {/if}

        {:else}
            <InfoContainer
                state="error"
                title="Insecure Context"
                message="This application requires a secure context (HTTPS)"
            />
        {/if}

        {#if (self.connector.state === 'connecting' || self.connector.state === 'failed') && self.connector.dialog}
            <InfoContainer
                state={self.connector.state === 'connecting' ? 'info' : 'error'}
                title={self.connector.dialog.title}
                message={self.connector.dialog.message}
            />
        {/if}
    </section>
</main>
