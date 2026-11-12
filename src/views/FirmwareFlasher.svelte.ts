import type { ViewManager, ViewManagerProps } from "$lib/services/ViewManager.svelte";
import { isDevMode } from "$lib/utils/Helpers.svelte";
import { ESPLoader, Transport, type LoaderOptions, type FlashOptions, type FlashModeValues, type FlashFreqValues, type FlashSizeValues, type IEspLoaderTerminal, } from "esptool-js";
import { firmwares } from "$lib/assets/firmwares";

// const FirmwareMap: FirmwareOptions[] = [
//     {
//         friendlyName: "OSSM Official",
//         flashMode: "dio",
//         flashFreq: "40m",
//         flashSize: "4MB", // PIO config for official says it can use 16mb but the partition.csv file equates to about 4mb
//         fileArray: [
//             {
//                 // Bootloader
//                 address: 0x1000,
//                 data: async () => { throw new Error("Method not implemented") },
//             },
//             {
//                 // Partitions
//                 address: 0x8000,
//                 data: async () => { throw new Error("Method not implemented") },
//             },
//             {
//                 // OTA
//                 address: 0xe000,
//                 data: async () => { throw new Error("Method not implemented") },
//             },
//             {
//                 // Firmware
//                 address: 0x10000,
//                 data: async () => { throw new Error("Method not implemented") },
//             }
//         ]
//     },
//     {
//         friendlyName: "OSSM Lite",
//         flashMode: "dio",
//         flashFreq: "40m",
//         flashSize: "4MB",
//         fileArray: [
//             {
//                 // Bootloader
//                 address: 0x1000,
//                 data: async () => { throw new Error("Method not implemented") },
//             },
//             {
//                 // Partitions
//                 address: 0x8000,
//                 data: async () => { throw new Error("Method not implemented") },
//             },
//             {
//                 // OTA
//                 address: 0xe000,
//                 data: async () => { throw new Error("Method not implemented") },
//             },
//             {
//                 // Firmware
//                 address: 0x10000,
//                 data: async () => { throw new Error("Method not implemented") },
//             }
//         ]
//     }
// ];

export type FirmwareFlasherParams = {
    readonly transport: Transport;
    readonly espLoader: ESPLoader;
};

export type FirmwareFlasherProps = ViewManagerProps & FirmwareFlasherParams;

export class FirmwareFlasher implements Disposable {
    // #region Static helpers
    static isSupported(): boolean {
        return "serial" in navigator;
    }

    /** To be consumed immediately by FirmwareFlasher.svelte */
    static async bootstrap(): Promise<FirmwareFlasherParams> {
        const port = await navigator.serial.requestPort({
            filters: [{
                // Silicon Labs CP210x (common driver for the esp32)
                usbVendorId: 0x10c4,
                usbProductId: 0xea60
            }]
        });

        let transport: Transport;
        let espLoader: ESPLoader;
        try {
            transport = new Transport(port, isDevMode);
            const loaderOptions: LoaderOptions = {
                transport: transport,
                baudrate: 115200,
                terminal: isDevMode ? {
                    clean: () => {},
                    writeLine: data => console.log("[Serial]", data),
                    write: data => console.log("[Serial]", data),
                } : undefined,
                debugLogging: isDevMode
            };
            espLoader = new ESPLoader(loaderOptions);
            await espLoader.main();
        } catch (err) {
            await port.close();
            throw err;
        }

        return { transport, espLoader };
    }
    // #endregion

    progress = $state(null);

    constructor(private getProps: () => FirmwareFlasherProps) {
    }

    [Symbol.dispose](): void {
        this.dispose();
    }

    async dispose() {
        this.getProps().transport.disconnect();
    }
}
