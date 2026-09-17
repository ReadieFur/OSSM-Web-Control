<script lang="ts">
    import "./LandingView.svelte.ts";
</script>

<main>
    <section class="card">
        <h1>OSSM Web Control</h1>
        <button id="pair-device-button" class="space-between hidden"><span class="material-symbol" data-icon="bluetooth_searching"></span>Connect OSSM</button>
        <button id="install-pwa-button" class="space-between hidden"><span class="material-symbol" data-icon="deployed_code_update"></span>Install PWA</button>
    </section>
</main>

<style lang="scss">
    @import "./LandingView.scss";
</style>