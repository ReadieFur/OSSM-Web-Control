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
