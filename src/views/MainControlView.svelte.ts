import type { ViewManager, ViewManagerProps } from '$lib/state/viewManager.svelte.ts';
import type { OssmDevice } from '$lib/services/OssmDevice.svelte.ts';
import { isDevMode } from '$lib/utils/Helpers.svelte.ts';
import { SvelteURLSearchParams } from 'svelte/reactivity';

export interface Props extends ViewManagerProps {
    readonly viewManager: ViewManager;
    readonly ossmInstance: OssmDevice;
}

export class MainControlView {
    // #region UI states
    // Connection
    connectionState = $state<'disconnected' | 'reconnecting' | 'connected'>('disconnected');
    disableControls = $derived(this.connectionState !== 'connected');

    // Patterns
    patterns = $state<Record<string, { name: string; description: string }>>({
        // Sample data for patterns
        'pattern-0': {
            name: 'Pattern 1',
            description: 'Lorem ipsum dolor sit amet'
        },
        'pattern-1': {
            name: 'Pattern 2',
            description: 'consectetur adipiscing elit'
        }
    });
    selectedPattern = $state('pattern-0');
    readonly selectedPatternDescription = $derived(this.patterns[this.selectedPattern]?.description ?? 'No pattern selected');
    // Use $effect to auto select the first key if a pattern is not selected? (for now no because it will be set by the machine state when active)

    // Controls
    controlRange = $state({
        from: 0,
        to: 10
    });
    controlSpeed = $state(0);
    controlIntensity = $state(50);
    controlInvertIntensity = $state(false);
    // #endregion

    constructor(private getProps: () => Props) {
        if (isDevMode && new SvelteURLSearchParams(globalThis.location?.search).get('viewOverride'))
            this.connectionState = 'connected'; // For development mode, override the connection state to connected
    }
    
    // Getters for inherited props
    get viewManager() { return this.getProps().viewManager; }
    get ossmInstance() { return this.getProps().ossmInstance; }
}
