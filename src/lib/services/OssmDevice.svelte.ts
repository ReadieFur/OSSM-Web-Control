import { OssmStatus } from '$lib/ossm-ble-web/src/ossmBle';
import type { OssmState, OssmPattern } from 'ossm-ble-web';
import { PatternHelper } from 'ossm-ble-web';

export type LifecycleState = 'uninitialized' | 'initializing' | 'ready' | 'disposed';
export type ConnectionState = 'disconnected' | 'reconnecting' | 'connected';
export const EmptyOssmState: OssmState = {
    status: OssmStatus.Idle,
    speed: 0,
    stroke: 0,
    sensation: 0,
    depth: 0,
    pattern: 0
};

export abstract class OssmDevice {
    // Instance properties
    abstract get lifecycleState(): LifecycleState;
    abstract get statusMessage(): string | null;
    abstract get errorMessage(): string | null;

    // Device properties
    abstract get connectionState(): ConnectionState;
    abstract get currentState(): OssmState;
    abstract get patterns(): OssmPattern[];
}

export class DummyOssmDevice extends OssmDevice {
    lifecycleState: LifecycleState = $state('ready');
    statusMessage: string | null = $state(null);
    errorMessage: string | null = $state(null);
    connectionState: ConnectionState = $state('connected');
    currentState: OssmState = $state({
        status: OssmStatus.StrokeEngineIdle,
        ...new PatternHelper(0, 15, 60, 30, 50, true)
    });
    patterns: OssmPattern[] = $state([
        { idx: 0, name: 'Pattern 1', description: 'Lorem ipsum dolor sit amet' },
        { idx: 1, name: 'Pattern 2', description: 'consectetur adipiscing elit' }
    ]);

    constructor(doDynamicUpdate: boolean = false) {
        super();
        if (doDynamicUpdate) {
            setTimeout(() => {
                this.currentState = {
                    status: OssmStatus.StrokeEnginePattern,
                    ...new PatternHelper(0, 5, 25, 70, 40, false)
                };
            }, 2000);
        }
    }
}
