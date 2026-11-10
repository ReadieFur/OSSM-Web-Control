import { OSSM_LITE_SERVICE_UUIDS, OSSM_SERVICE_UUID, type ICancellationToken } from "$lib/ossm-ble-web/dist/ossm-ble-web";
import { OssmRadProvider } from "./OssmRadProvider.svelte";
import { OssmLiteProvider } from "./OssmLiteProvider.svelte";
import type { OssmProvider } from "./OssmProvider.svelte";

type BleProviderInfo = Readonly<{
    friendlyName: string,
    modelString?: string,
    serviceUuids: BluetoothServiceUUID[],
    initializer: (d: BluetoothDevice, ct: ICancellationToken) => Promise<OssmProvider>
}>;

export type BleProvidersResult = Readonly<{
    friendlyName: string,
    initialize: (ct: ICancellationToken) => Promise<OssmProvider>
}>;

const DEVICE_INFO_SERVICE_UUID = 0x180A;
const MODEL_UUID = 0x2A24;

export class BleInitializer {
    static readonly #providers: BleProviderInfo[] = [
        {
            friendlyName: "OSSM Lite",
            modelString: "OSSM Lite",
            serviceUuids: [...OSSM_LITE_SERVICE_UUIDS],
            initializer: OssmLiteProvider.initializeInstance
        },
        {
            friendlyName: "Official Firmware",
            modelString: "OSSM",
            serviceUuids: [OSSM_SERVICE_UUID],
            initializer: OssmRadProvider.initializeInstance
        }
    ];

    /**
     * Prompts the user to connect a BLE device & discovers matching providers
     * @returns A list of matching providers with the paired device injected into it's initializer & the providers friendly names
     * @note Must be consumed instantly
     */
    static async pairDeviceAndDiscoverProviders(ct: ICancellationToken): Promise<BleProvidersResult[]> {
        const bleDevice = await navigator.bluetooth.requestDevice({
            filters: [{ name: "OSSM" }],
            optionalServices: [DEVICE_INFO_SERVICE_UUID, ...BleInitializer.#providers.flatMap(p => p.serviceUuids)],
        });

        if (!bleDevice.gatt)
            throw new DOMException("Device is not connectable via GATT.", "NotSupportedError");

        const MAX_CONNECT_ATTEMPTS = 3;
        const RETRY_INTERVAL = 250;
        for (let i = 0; i < MAX_CONNECT_ATTEMPTS; i ++) {
            ct.throwIfCancellationRequested();
            
            try {
                await bleDevice.gatt.connect();
                break;
            }
            catch {
                console.warn(`BLE Preconnect failed (${i}/${MAX_CONNECT_ATTEMPTS})`);
                
                if (i == MAX_CONNECT_ATTEMPTS)
                    throw new DOMException("Failed to connect to BLE device", "OperationError");
                
                await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
            }
        }
        const ctCb = ct.register(() => {
            bleDevice.gatt?.disconnect();
            bleDevice.forget();
        });
        ct.throwIfCancellationRequested();

        const dec = new TextDecoder();
        const deviceServices = new Map((await bleDevice.gatt.getPrimaryServices())
            .map(s => [BleInitializer.#normalizeUuid(s.uuid), s]));

        let deviceModelId: string | undefined;
        const deviceInfoService = deviceServices.get(BleInitializer.#normalizeUuid(DEVICE_INFO_SERVICE_UUID));
        if (deviceInfoService) {
            const chars = new Map((await deviceInfoService.getCharacteristics()).map(c => [BleInitializer.#normalizeUuid(c.uuid), c]));

            const modelId = dec.decode(await chars.get(BleInitializer.#normalizeUuid(MODEL_UUID))?.readValue());
            if (modelId.trim()) deviceModelId = modelId;
        }

        const discoveredProviders: BleProvidersResult[] = [];
        /* The .sort here means we will match by most specific service first
         * (aids in picking the more advanced provider when a device has overlapping services)
         */
        for (const provider of BleInitializer.#providers.sort((a, b) => b.serviceUuids.length - a.serviceUuids.length)) {

            /*
             * If the device does not have a model ID, skip this check
             * If the device has a model ID & the config does not, continue
             * If the device has a model ID & the config does not match, continue
             * If the device has a model ID & the config matches, pass
             * If the device does not have a model string & the config does, continue
             */
            if (provider.modelString ? deviceModelId !== provider.modelString : !!deviceModelId)
                continue;
            
            /* Check if the provider IDs are advertised by the device, convert short-form UUIDs to full strings */
            if (!new Set(deviceServices.keys()).isSupersetOf(new Set(provider.serviceUuids.map(BleInitializer.#normalizeUuid))))
                continue;

            discoveredProviders.push({
                friendlyName: provider.friendlyName,
                initialize: ct => provider.initializer(bleDevice, ct)
            });
        }
        ct.throwIfCancellationRequested();

        // The providers must be started from a disconnected state
        bleDevice.gatt.disconnect();
        ctCb.unregister();
        
        return discoveredProviders;
    }

    static #normalizeUuid(uuid: BluetoothServiceUUID): string {
        return (typeof uuid === "number"
            ? `0000${uuid.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb` // Tail of this is BLE standard
            : uuid
        ).toLowerCase().trim();
    }
}
