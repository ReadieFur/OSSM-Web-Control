<script lang="ts">
    let { children } = $props();
</script>

<svelte:head>
    <script>console.log(`👁️🦌👁️! What are you doing here?`);</script>
</svelte:head>

<div class="app-background"></div>

<main class="app-shell">
    {@render children()}

    <!-- Due to how I position the footer (directly under the main content), this must live inside the app-shell -->
    <footer id="footer">
        <p>Made with ❤️ by <a href="https://github.com/ReadieFur/OSSM-Web-Control" target="_blank" rel="noopener noreferrer">ChloeDoe</a> 🦌!</p>
    </footer>
</main>


<style lang="scss">
    @import "$lib/styles/global.scss";
    @import "$lib/styles/layout.scss";
</style>
