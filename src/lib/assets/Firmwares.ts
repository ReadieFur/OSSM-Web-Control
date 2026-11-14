import { base } from '$app/paths';
import _firmwaresJson from "$lib/assets/firmwares.json";
import { type LoaderOptions, type FlashOptions, type FlashModeValues, type FlashFreqValues, type FlashSizeValues, type IEspLoaderTerminal, } from "esptool-js";

type SimpleFirmwares = Record<string, {
    friendlyName: string
}>;

const simpleFirmwares: SimpleFirmwares = _firmwaresJson satisfies SimpleFirmwares;
const simpleFirmwaresUriSafeToKey = new Map(Object.keys(simpleFirmwares).map(k => [k.replace(/[/#]/g, "_"), k]));

type NodeFirmwaresManifest = Record<string, {
    flashMode: FlashModeValues,
    flashSize: FlashSizeValues,
    flashFreq: FlashFreqValues,
    flashFiles: [{
        offset: number,
        file: string,
        sha256: string
    }]
}>;

export type FirmwaresManifest = Record<string,
    SimpleFirmwares[string]
    & {
        source: {
            author: string,
            repo: string,
            tag: string,
            subPath?: string,
            pioEnv?: string
        }
    }
    & NodeFirmwaresManifest[string]
>;

export class Firmwares {
    static async fetchManifest(): Promise<FirmwaresManifest> {
        const response = await fetch(`${base}/firmwares/manifest.json`);

        if (!response.ok) {
            switch (response.status) {
                case 404:
                    console.warn("Firmware manifest not found");
                    return {};
                default:
                    throw new DOMException(`Failed to fetch firmware manifest: ${response.status} ${response.statusText}`, "NetworkError");
            }
        }

        const firmwares: FirmwaresManifest = {};
        for (const [sourceUriSafe, manifest] of Object.entries(await response.json() as NodeFirmwaresManifest)) {
            const sourceStr = simpleFirmwaresUriSafeToKey.get(sourceUriSafe);

            if (!sourceStr) {
                console.warn(`Node firmwares had an entry that was not in simpleFirmwares, skipping...`, sourceStr);
                continue;
            }

            const [, author, repo, tag, subPath = undefined, pioEnv = undefined] = sourceStr.match(/^([^/#]+)\/([^#]+)#([^/#]+)(?:\/([^#]+))?(?:#(.+))?$/)!;

            firmwares[sourceUriSafe] = {
                ...simpleFirmwares[sourceUriSafe],
                source: {
                    author,
                    repo,
                    tag,
                    subPath,
                    pioEnv
                },
                ...manifest
            }
        }
        return firmwares;
    }
}
