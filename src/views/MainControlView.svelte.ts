import type { ViewManager, ViewManagerProps } from "$lib/services/ViewManager.svelte";
import type { OssmInterface } from "$lib/services/OssmInterface.svelte";
import type { RangeChangeEvent } from "$component/SliderDoubleInput.svelte";

export interface Props extends ViewManagerProps {
    readonly viewManager: ViewManager;
    ossmInterface: OssmInterface;
}

export class MainControlView {
    disableControls = $derived(this.ossmInterface.state !== "ready");
    selectedPattern = $state(0);
    controlRange = $state({ from: 0, to: 0 });
    controlSpeed = $state(0);
    controlHasSensation = $derived.by(() => this.ossmInterface.patterns.find(p => p.idx === this.ossmInterface.playState.patternIdx)?.hasSensation ?? true);
    controlCanInvertIntensity = $derived.by(() => this.ossmInterface.patterns.find(p => p.idx === this.ossmInterface.playState.patternIdx)?.canSensationInvert ?? false);
    controlSensation = $state(0);
    controlInvertSensation = $state(false);
    // #endregion

    // Getters for inherited props (via the "private ..." parameter in the constructor)
    get viewManager() { return this.getProps().viewManager; }
    get ossmInterface() { return this.getProps().ossmInterface; }

    constructor(private getProps: () => Props) {
        $effect(() => {
            // TODO: Extract pattern properties before updating the control values, so that we can determine if the selected pattern has intensity control
            this.selectedPattern = this.ossmInterface.playState.patternIdx;
            this.controlRange = this.#rawToRange(this.ossmInterface.playState.depth, this.ossmInterface.playState.stroke);
            this.controlSpeed = this.ossmInterface.playState.speed;
            this.controlSensation = this.ossmInterface.playState.sensation;
        });
    }

    #clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max);
    }

    #rawToRange(depth: number, stroke: number): { from: number; to: number } {
        depth = this.#clamp(depth, 0, 100);
        stroke = this.#clamp(stroke, 0, 100);

        // Cap stroke so that it cant make a negative from value
        stroke = this.#clamp(stroke, 0, depth);
        
        return {
            from: depth - stroke,
            to: depth
        };
    }

    #rangeToRaw(from: number, to: number) {
        const depth = to;
        const stroke = to - from;

        return {
            depth: this.#clamp(depth, 0, 100),
            stroke: this.#clamp(stroke, 0, 100)
        };
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
