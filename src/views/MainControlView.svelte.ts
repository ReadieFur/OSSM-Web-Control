import type { ViewManager, ViewManagerProps } from '$lib/state/viewManager.svelte.ts';
import type { OssmDevice } from '$lib/services/OssmDevice.svelte.ts';
import type { RangeChangeEvent } from '$component/SliderDoubleInput.svelte';
import { PatternHelper } from 'ossm-ble-web';

export interface Props extends ViewManagerProps {
    readonly viewManager: ViewManager;
    ossmInstance: OssmDevice;
}

export class MainControlView {
    disableControls = $derived(this.ossmInstance.connectionState !== 'connected');
    selectedPattern = $state(0);
    controlRange = $state({ from: 0, to: 0 });
    controlSpeed = $state(0);
    controlHasIntensity = $derived.by(() => true); // TODO
    controlCanInvertIntensity = $derived.by(() => true); // TODO
    controlIntensity = $state(0);
    controlInvertIntensity = $state(false);
    // #endregion

    // Getters for inherited props (via the 'private ...' parameter in the constructor)
    get viewManager() { return this.getProps().viewManager; }
    get ossmInstance() { return this.getProps().ossmInstance; }

    constructor(private getProps: () => Props) {
        $effect(() => {
            // TODO: Extract pattern properties before updating the control values, so that we can determine if the selected pattern has intensity control
            const patternHelper = PatternHelper.fromPlayData(this.ossmInstance.currentState, this.controlHasIntensity, this.controlCanInvertIntensity);
            this.selectedPattern = this.ossmInstance.currentState.pattern;
            this.controlRange = { from: patternHelper.minDepth, to: patternHelper.maxDepth };
            this.controlSpeed = patternHelper.speed;
            this.controlIntensity = patternHelper.intensity ?? 0;
            this.controlInvertIntensity = patternHelper.invert ?? false;
        });
    }

    onRangeChange(newRange: RangeChangeEvent) {
        console.log(newRange);
    }

    onSpeedChange(newSpeed: number) {
        console.log(newSpeed);
    }

    onIntensityChange(newIntensity: number) {
        console.log(newIntensity);
    }
}
