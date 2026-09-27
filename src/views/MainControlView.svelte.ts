import type { ViewManager, ViewManagerProps } from "$lib/services/ViewManager.svelte";
import LandingView from "$view/LandingView.svelte";
import { State, type OssmProvider } from "$lib/services/OssmProvider.svelte";
import type { RangeChangeEvent } from "$component/SliderDoubleInput.svelte";

export interface MainControlViewProps extends ViewManagerProps {
    readonly viewManager: ViewManager;
    ossmProvider: OssmProvider;
}

const estopClickTimeoutMs = 300;

export class MainControlView {
    disableControls = $derived(this.ossmProvider.state !== "ready");
    selectedPattern = $state(0);
    controlRange = $state({ from: 0, to: 0 });
    controlSpeed = $state(0);
    controlHasSensation = $derived.by(() => this.ossmProvider.patterns.get(this.selectedPattern)?.hasSensation ?? true);
    controlCanInvertSensation = $derived.by(() => this.ossmProvider.patterns.get(this.selectedPattern)?.canSensationInvert ?? false);
    controlSensation = $state(0);
    controlInvertSensation = $state(false);
    estopClickCount = $state(0);

    #disposed = false;
    #estopClickTimer?: number;

    // Getters for inherited props (via the "private ..." parameter in the constructor)
    get viewManager() { return this.getProps().viewManager; }
    get ossmProvider() { return this.getProps().ossmProvider; }

    constructor(private getProps: () => MainControlViewProps) {
        // Setup $effects
        this.onRemoteStateChange();
        this.onRemotePatternChange();
        this.onRemoteRangeChange();
        this.onRemoteSpeedChange();
        this.onRemoteSensationChange();
    }

    onRemoteStateChange(): void {
        $effect(() => {
            switch (this.ossmProvider.state) {
                case State.Error:
                    // TODO: Display error message
                    this.viewManager.setViewAndProps(LandingView);
                    break;
                case State.Disconnected:
                    // TODO: Display error message
                    if (!this.#disposed) {
                        this.#disposed = true;
                        this.viewManager.setViewAndProps(LandingView);
                    }
                    break;
                default:
                    break;
            }
        });
    }

    // Pattern
    onRemotePatternChange(): void {
        $effect(() => { this.selectedPattern = this.selectedPattern = this.ossmProvider.playState.patternId; })
    }

    onUiPatternChange(id: number): void {
        // Local pattern ID does not need to be set here since onRemotePatternChange watches for changes of the value below
        this.ossmProvider.playState = {
            ...this.ossmProvider.playState,
            patternId: id
        };
    }

    // Range
    onRemoteRangeChange(): void {
        $effect(() => {
            let depth = this.ossmProvider.playState.depth;
            let stroke = this.ossmProvider.playState.stroke;

            depth = this.#clampWhole(depth, 0, 100);
            stroke = this.#clampWhole(stroke, 0, 100);

            // Cap stroke so that it cant make a negative from value
            stroke = this.#clampWhole(stroke, 0, depth);

            this.controlRange = {
                from: depth - stroke,
                to: depth
            };
        });
    }

    onUiRangeChange(range: RangeChangeEvent): void {
        this.ossmProvider.playState = {
            ...this.ossmProvider.playState, // Use expansion here to avoid firing two events for the value change (i.e. change everything all at once)
            depth: this.#clampWhole(range.value.to, 0, 100),
            stroke: this.#clampWhole(range.value.to - range.value.from, 0, 100)
        };
    }

    // Speed
    onRemoteSpeedChange(): void {
        $effect(() => { this.controlSpeed = this.#clampWhole(this.ossmProvider.playState.speed, 0, 100); });
    }

    onUiSpeedChange(speed: number): void {
        this.ossmProvider.playState = {
            ...this.ossmProvider.playState,
            speed: speed
        };
    }

    // Sensation
    onRemoteSensationChange(): void {
        $effect(() => {
            const rawSensation = this.#clampWhole(this.ossmProvider.playState.sensation, 0, 100);

            if (this.controlCanInvertSensation) {
                // Sensation < 50 means inverted=true
                this.controlInvertSensation = rawSensation < 50;
                this.controlSensation = Math.abs((rawSensation - 50) * 2);
            } else {
                this.controlInvertSensation = false;
                this.controlSensation = rawSensation;
            }
        });
    }

    onUiSensationChange(sensation: number): void {
        let targetSensation: number;

        if (this.controlCanInvertSensation) {
            if (this.controlInvertSensation) {
                // UI 0..100 maps to sensation 50..0
                targetSensation = 50 - (sensation / 2);
            } else {
                // UI 0..100 maps to sensation 0..50
                targetSensation = 50 + (sensation / 2);
            }
        } else {
            targetSensation = sensation;
        }

        // Clamp value between 0 and 100 before committing
        this.ossmProvider.playState = {
            ...this.ossmProvider.playState,
            sensation: this.#clampWhole(targetSensation, 0, 100)
        };
    }

    // Buttons
    onUiStopClick(): void {
        this.estopClickCount++;

        // If multiple presses are detected in short succession, immediately call for an emergency stop
        // If emergency stop is active, make all presses on the stop button trigger another estop
        if (this.ossmProvider.state === State.EmergencyStop || this.estopClickCount >= 2) {
            if (this.#estopClickTimer) {
                clearTimeout(this.#estopClickTimer);
                this.#estopClickTimer = undefined;
            }
            this.estopClickCount = 0;

            console.warn("[ControlView] Emergency stop!");
            this.ossmProvider.emergencyStop();
            return;
        }

        // Reset the timer for regular clicks
        if (this.#estopClickTimer) clearTimeout(this.#estopClickTimer);

        // If the timeout occurs, perform a regular stop instead of the above emergency stop
        this.#estopClickTimer = window.setTimeout(async () => {
            this.estopClickCount = 0;
            this.#estopClickTimer = undefined;
            
            this.ossmProvider.playState = {
                ...this.ossmProvider.playState,
                speed: 0
            };
        }, estopClickTimeoutMs);
    }

    onUiRecalibrateClick(): void {
        this.ossmProvider.recalibrate();
    }

    onUiDisconnectClick(): void {
        this.ossmProvider.disconnect();
        if (!this.#disposed)
            this.viewManager.setViewAndProps(LandingView);
    }

    // #region Helpers
    #clampWhole(value: number, min: number, max: number): number {
        return Math.round(Math.min(Math.max(value, min), max));
    }
    // #endregion
}
