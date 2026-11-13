import fs from 'node:fs';
import path from 'node:path';

const packageJsonPath = path.resolve('./package.json');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Generate the calver patch string
const now = new Date();
const yyyy = now.getUTCFullYear();
const MM = String(now.getUTCMonth() + 1).padStart(2, '0');
const dd = String(now.getUTCDate()).padStart(2, '0');
const HH = String(now.getUTCHours()).padStart(2, '0');
const mm = String(now.getUTCMinutes()).padStart(2, '0');
const timestampPatch = `${yyyy}${MM}${dd}${HH}${mm}`;

// Parse the existing version string
const versionParts = pkg.version.split('.');
if (versionParts.length < 2 || versionParts.length > 3) {
    console.error('Error: package.json version must follow semantic versioning (MAJOR.MINOR.[PATCH])');
    process.exit(1);
}
versionParts[2] = timestampPatch;
pkg.version = versionParts.join('.');

// Write back to package.json maintaining 2-space indentation
fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Version bumped to: ${pkg.version}`);
