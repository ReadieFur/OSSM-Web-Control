import type { ViewManager, ViewManagerProps } from '$lib/state/viewManager.svelte.ts';
import type { OssmDevice } from '$lib/services/OssmDevice.svelte.ts';

export interface Props extends ViewManagerProps {
    readonly viewManager: ViewManager;
    ossmInstance: OssmDevice;
}

export class MainControlView {
    disableControls = $derived(this.ossmInstance.connectionState !== 'connected');
    // TODO: Bind these $states to the OssmDevice instance
    selectedPattern = $state(0);
    controlRange = $state({
        from: 0,
        to: 10
    });
    controlSpeed = $state(0);
    controlIntensity = $state(50);
    controlInvertIntensity = $state(false);
    // #endregion

    // Getters for inherited props (via the 'private ...' parameter in the constructor)
    get viewManager() { return this.getProps().viewManager; }
    get ossmInstance() { return this.getProps().ossmInstance; }

    constructor(private getProps: () => Props) {}
}
