import { OssmStatus } from '$lib/ossm-ble-web/src/ossmBle';
import type { OssmState, OssmPattern } from 'ossm-ble-web';

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
    abstract lifecycleState: LifecycleState;
    abstract statusMessage: string | null;
    abstract errorMessage: string | null;

    // Device properties
    abstract connectionState: ConnectionState;
    abstract currentState: OssmState;
    abstract patterns: OssmPattern[];
}

export class DummyOssmDevice extends OssmDevice {
    lifecycleState: LifecycleState = 'ready'
    statusMessage: string | null = null;
    errorMessage: string | null = null;
    connectionState: ConnectionState = 'connected';
    currentState: OssmState = EmptyOssmState;
    patterns: OssmPattern[] = [
        { idx: 0, name: 'Pattern 1', description: 'Lorem ipsum dolor sit amet' },
        { idx: 1, name: 'Pattern 2', description: 'consectetur adipiscing elit' }
    ];
}
