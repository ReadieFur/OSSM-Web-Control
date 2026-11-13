import * as FS from "fs";
import * as OS from "os";
import path from "path";
import * as Crypto from 'crypto';
import { runCmd } from "./Common.js";

function notNull<T>(obj: T | undefined): T {
    if (obj === undefined || obj === null) throw new Error("Object was null");
    return obj;
}

function translateFlasherFile(file: string): string {
    // TODO: Figure out why these pio outputs mismatch
    switch (file) {
        case "bootloader/bootloader.bin": return "bootloader.bin";
        case "Software.bin": return "firmware.bin";
        case "partition_table/partition-table.bin": return "partitions.bin";
        default: return file;
    }
}

export async function compileFirmware(repoRef: string): Promise<void> {
    // Regex pattern for: [author]/[repo]#[sha]</path><#pio_environment>
    const match = repoRef.match(/^([^#]+)#([^/#]+)(?:\/([^#]+))?(?:#(.+))?$/);
    if (!match) throw new Error(`Invalid firmware reference format: '${repoRef}'`);
    const [, repoSlug, ref, subpath, pioEnv] = match;

    const repoUrl = `https://github.com/${repoSlug}.git`;
    const rootDir = process.cwd();
    const uriName = repoRef.replace(/[/#]/g, "_"); // Create a URI safe version of repoRef
    const buildDir = process.env.GITHUB_ACTIONS === "true"
        ? path.join(OS.tmpdir(), uriName)
        : path.join(rootDir, ".output", "firmware-builder", uriName);

    // Check if the build directory already exists (for localdev speedup)
    let gitInitialized = false;
    if (FS.existsSync(buildDir) && FS.statSync(path.join(buildDir, ".git"), { throwIfNoEntry: false })?.isDirectory()) {
        const res = await runCmd(["git", "-C", buildDir, "remote", "get-url", "origin"], true);
        gitInitialized = res.status === 0 && res.stdout.trim() === repoUrl;
    }

    if (gitInitialized) {
        console.log(`Using cached repository at ${buildDir}`);
        await runCmd(["git", "-C", buildDir, "fetch", "origin"], true);
    } else {
        if (FS.existsSync(buildDir)) throw new Error(`Target build directory is not empty: '${buildDir}'`)
        console.log(`Cloning repository recursively to ${buildDir}`);
        await runCmd(["git", "clone", "--recursive", repoUrl, buildDir], true);
    }

    process.chdir(buildDir);

    try {
        // Checkout the specific commit SHA or ref and update submodules
        await runCmd(["git", "checkout", ref], true);
        await runCmd(["git", "submodule", "update", "--init", "--recursive"], true);

        if (subpath) {
            const targetWorkDir = path.join(buildDir, subpath);
            if (!FS.existsSync(targetWorkDir)) throw new Error(`Target subpath '${subpath}' does not exist in cloned repository '${repoSlug}'`);
            process.chdir(targetWorkDir);
        }

        const pioCmd = ["pio", "run"];
        if (pioEnv) pioCmd.push("--environment", pioEnv);
        await runCmd(pioCmd, true);

        const artifactDir = process.env.GITHUB_ACTIONS === "true"
            ? path.join(rootDir, "build")
            : path.join(rootDir, "build", "firmwares", uriName);

        if (FS.existsSync(artifactDir)) FS.rmSync(artifactDir, { recursive: true });
        FS.mkdirSync(artifactDir, { recursive: true });

        const flasherArgsPaths = FS.globSync(".pio/build/**/flasher_args.json");
        if (flasherArgsPaths.length === 0) throw new Error("Build completed but flasher_args.json was not found");
        const binFiles = FS.globSync(".pio/build/**/*.bin");
        if (binFiles.length === 0) throw new Error("Build completed but no .bin files were found");

        const flasherArgsJson = JSON.parse(FS.readFileSync(flasherArgsPaths[0], "utf8")) as {
            flash_settings?: {
                flash_mode?: string,
                flash_size?: string,
                flash_freq?: string
            };
            flash_files?: Record<string, string>;
        };

        const manifestBinaries: Set<string> = new Set();
        const manifest = {
            flashMode: notNull(flasherArgsJson.flash_settings?.flash_mode),
            flashSize: notNull(flasherArgsJson.flash_settings?.flash_size) !== "detect" ? flasherArgsJson.flash_settings!.flash_size! : "4m",
            flashFreq: notNull(flasherArgsJson.flash_settings?.flash_freq),
            flashFiles: Object.entries(notNull(flasherArgsJson.flash_files)).map(([offsetStr, filePath]) => {
                const correctedFilePath = translateFlasherFile(filePath);
                const fileName = path.basename(correctedFilePath);
                manifestBinaries.add(fileName);
                return {
                    offset: parseInt(offsetStr, 16),
                    file: fileName,
                    sha256: Crypto.createHash('sha256')
                        .update(FS.readFileSync(path.join(path.dirname(flasherArgsPaths[0]), correctedFilePath)))
                        .digest('hex')
                };
            })
        };

        const collectedBinaries: Set<string> = new Set();
        for (const binPath of binFiles) {
            const fileName = path.basename(binPath);
            collectedBinaries.add(fileName);

            // Skip the following file(s):
            if (fileName.includes("CMakeDetermineCompilerABI")) continue;

            const destPath = path.join(artifactDir, fileName);
            FS.copyFileSync(binPath, destPath);

            const stats = FS.statSync(binPath);
            FS.chmodSync(destPath, stats.mode);
            FS.utimesSync(destPath, stats.atime, stats.mtime);

            console.log(`Collected file for artifact: '${fileName}'`);
        }

        if (collectedBinaries.size === manifestBinaries.size && [...collectedBinaries].every(i => manifestBinaries.has(i)))
            throw new Error("Collected files did not match that of the manifest")

        FS.writeFileSync(path.join(artifactDir, "manifest.json"), JSON.stringify(manifest), "utf-8");
        console.log(`Manifest for ${repoRef}: ` + JSON.stringify(manifest, null, 2));
    } finally {
        process.chdir(rootDir);
    }
}

async function main(): Promise<void> {
    if (!process.argv[2])
        process.exit(1);

    await compileFirmware(process.argv[2]);
}

if (import.meta.main)
    await main();
