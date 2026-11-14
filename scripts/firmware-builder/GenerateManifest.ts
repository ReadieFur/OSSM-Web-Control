import * as FS from "fs";
import path from "path";

export function generateManifest(firmwaresDir: string, deleteSource: boolean): void {
    if (!FS.existsSync(firmwaresDir)) throw new Error(`Directory "${firmwaresDir}" does not exist.`);

    const combinedManifest: Record<string, unknown> = {};

    for (const firmware of FS.readdirSync(firmwaresDir)) {
        const firmwarePath: string = path.join(firmwaresDir, firmware);
        const stat = FS.statSync(firmwarePath);
        if (!stat.isDirectory()) continue;

        const manifestPath = path.join(firmwarePath, "manifest.json");
        if (!FS.existsSync(manifestPath)) continue;

        combinedManifest[firmware] = JSON.parse(FS.readFileSync(manifestPath, "utf8"));
        if (deleteSource) FS.rmSync(manifestPath, { force: true });

        console.log(`Processed manifest for "${firmware}"`);
    }

    FS.writeFileSync(
        path.join(firmwaresDir, "manifest.json"),
        process.env.GITHUB_ACTIONS === "true" ? JSON.stringify(combinedManifest) : JSON.stringify(combinedManifest, null, 4),
        "utf8"
    );
    console.log("Firmwares manifest: " + JSON.stringify(combinedManifest, null, 2));
}

function main(): void {
    generateManifest(path.resolve(process.cwd(), process.argv.slice(2)[0]), true);
}

if (import.meta.main)
    main();
