import * as FS from "fs";
import * as OS from "os";
import path from "path";
import { runCmd } from "./Common.js";

export async function compileFirmware(repoRef: string): Promise<void> {
    // Regex pattern for: [author]/[repo]#[sha]</path><#pio_environment>
    const match = repoRef.match(/^([^#]+)#([^/#]+)(?:\/([^#]+))?(?:#(.+))?$/);
    if (!match) throw new Error(`Invalid firmware reference format: '${repoRef}'`);
    const [, repoSlug, ref, subpath, pioEnv] = match;

    const repoUrl = `https://github.com/${repoSlug}.git`;
    const rootDir = process.cwd();
    const uriName = repoRef.replace(/[/#]/g, "_"); // Create a URI safe version of repoRef
    const buildDir = path.join(OS.tmpdir(), uriName);

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
        
        const binFiles = FS.globSync(".pio/build/**/*.bin");
        if (binFiles.length === 0) throw new Error(`Build completed but no .bin files were found`);

        for (const binPath of binFiles) {
            const fileName = path.basename(binPath);

            // Skip the following file(s):
            if (fileName.includes("CMakeDetermineCompilerABI")) continue;

            const destPath = path.join(artifactDir, fileName);
            FS.copyFileSync(binPath, destPath);

            const stats = FS.statSync(binPath);
            FS.chmodSync(destPath, stats.mode);
            FS.utimesSync(destPath, stats.atime, stats.mtime);

            console.log(`Collected file for artifact: '${fileName}'`);
        }
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
