import { base } from '$app/paths';
import _firmwaresJson from "$lib/assets/firmwares.json";
import { type FlashModeValues, type FlashFreqValues, type FlashSizeValues } from "esptool-js";

type TSimpleFirmwaresJson = ReadonlyArray<string>;
const simpleFirmwares: ReadonlySet<TSimpleFirmwaresJson[number]> = new Set(_firmwaresJson satisfies TSimpleFirmwaresJson);

type TNodeFirmwaresManifest = {
    job: string,
    firmwares: Record<string, {
        flashMode: FlashModeValues,
        flashSize: FlashSizeValues,
        flashFreq: FlashFreqValues,
        binaries: Record<string, {
            offset: number,
            sha256: string,
            md5: string
        }>
    }>;
}

export type FirmwaresManifest = {
    buildJob?: string,
    firmwares: Record<string,
        {
            source: {
                author: string,
                repo: string,
                tag?: string,
                subPath?: string,
                pioEnv?: string
            }
        }
        & TNodeFirmwaresManifest["firmwares"][string]
    >
};

export class Firmwares {
    static readonly #basePath = `${base}/firmwares`;

    static async fetchManifest(): Promise<FirmwaresManifest> {
        const response = await fetch(`${Firmwares.#basePath}/manifest.json`);

        if (!response.ok) {
            switch (response.status) {
                case 404:
                    console.warn("Firmware manifest not found");
                    return { firmwares: {} };
                default:
                    throw new DOMException(`Failed to fetch firmware manifest: ${response.status} ${response.statusText}`, "NetworkError");
            }
        }

        const firmwares: FirmwaresManifest["firmwares"] = {};
        const nodeManifest = await response.json() as TNodeFirmwaresManifest;

        // Retains order that is defined in firmwares.json (due to how firmware builder pipeline works this order is lost)
        const orderedSources = [
            ...[...simpleFirmwares].filter(source => source in nodeManifest.firmwares),
            ...Object.keys(nodeManifest.firmwares).filter(source => !simpleFirmwares.has(source)) // Should always return nothing
        ];

        for (const source of orderedSources) {
            const manifest = nodeManifest.firmwares[source];
            const [, author, repo, tag = undefined, subPath = undefined, pioEnv = undefined] = source.match(/^([^/#]+)\/([^#]+)#([^/#]+)(?:\/([^#]+))?(?:#(.+))?$/)!;

            firmwares[source] = {
                source: {
                    author,
                    repo,
                    tag,
                    subPath,
                    pioEnv
                },
                ...manifest
            };
        }

        return {
            buildJob: nodeManifest.job !== "" ? nodeManifest.job : undefined,
            firmwares
        }
    }

    static sourceToString(sourceObj: FirmwaresManifest["firmwares"][string]["source"]): string {
        let str = `${sourceObj.author}/${sourceObj.repo}#${sourceObj.tag}`;
        if (sourceObj.subPath) str += `/${sourceObj.subPath}`;
        if (sourceObj.pioEnv) str += `#${sourceObj.pioEnv}`;
        return str;
    }

    static getBinaryUri(sourceKey: keyof FirmwaresManifest["firmwares"], fileName: keyof FirmwaresManifest["firmwares"][string]["binaries"]): string {
        return `${this.#basePath}/${encodeURIComponent(sourceKey)}/${fileName}`;
    }
}
