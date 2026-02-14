#!/usr/bin/env node
/**
 * Build tool that converts HTML template files into TypeScript files
 * with the HTML inlined as a string export.
 *
 * Supports two naming patterns:
 * - *.template.html → *.template.ts (legacy flat structure)
 * - template.html → template.ts (component directory structure)
 *
 * This gives us:
 * - Syntax highlighting in .html files during development
 * - No bundler dependency for consumers (they get plain JS)
 * - Zero runtime overhead (just a string constant)
 *
 * Usage:
 *   build-templates [srcDir]
 *   build-templates              # defaults to ./src
 *   build-templates ./src/components
 */

import {
    readFileSync,
    writeFileSync,
    readdirSync,
    statSync,
    existsSync,
} from "fs";
import { join, basename, dirname, resolve } from "path";

const args = process.argv.slice(2);
const srcDir = resolve(process.cwd(), args[0] || "./src");

if (!existsSync(srcDir)) {
    console.error(`Error: Directory not found: ${srcDir}`);
    process.exit(1);
}

/**
 * Check if a file is a template HTML file
 * Matches: *.template.html or template.html
 */
function isTemplateFile(filename) {
    return filename.endsWith(".template.html") || filename === "template.html";
}

/**
 * Get the output TypeScript path for a template file
 */
function getOutputPath(htmlPath) {
    const filename = basename(htmlPath);
    if (filename === "template.html") {
        return join(dirname(htmlPath), "template.ts");
    }
    return htmlPath.replace(".template.html", ".template.ts");
}

/**
 * Get the component name from the template path
 * For template.html, uses the parent directory name
 * For *.template.html, uses the filename prefix
 */
function getComponentName(htmlPath) {
    const filename = basename(htmlPath);
    if (filename === "template.html") {
        return basename(dirname(htmlPath));
    }
    return basename(htmlPath, ".template.html");
}

/**
 * Find all template HTML files recursively
 */
function findTemplateFiles(dir, files = []) {
    for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            findTemplateFiles(fullPath, files);
        } else if (isTemplateFile(entry)) {
            files.push(fullPath);
        }
    }
    return files;
}

/**
 * Convert HTML file to TypeScript with exported string
 */
function generateTemplateTS(htmlPath) {
    const html = readFileSync(htmlPath, "utf-8");
    const componentName = getComponentName(htmlPath);

    // Escape backticks and backslashes for template literal
    const escaped = html
        .replace(/\\/g, "\\\\")
        .replace(/`/g, "\\`")
        .replace(/\$\{/g, "\\${");

    return `// AUTO-GENERATED - DO NOT EDIT
// Generated from ${basename(htmlPath)} by @pojagi/build-templates

/**
 * Template HTML for <${componentName}>
 * Edit the source ${basename(htmlPath)} file, not this file.
 */
export const template = \`${escaped}\`;
`;
}

/**
 * Main build function
 */
function build() {
    const templateFiles = findTemplateFiles(srcDir);

    if (templateFiles.length === 0) {
        console.log("No template files found");
        return;
    }

    console.log(`Building ${templateFiles.length} template(s)...`);

    for (const htmlPath of templateFiles) {
        const tsPath = getOutputPath(htmlPath);
        const content = generateTemplateTS(htmlPath);
        writeFileSync(tsPath, content, "utf-8");
        console.log(`  ✓ ${basename(htmlPath)} → ${basename(tsPath)}`);
    }

    console.log("Done!");
}

build();
