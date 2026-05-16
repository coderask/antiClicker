/**
 * Custom sign script for electron-builder ad-hoc macOS signing.
 *
 * electron-builder's default mac signing always passes --timestamp to codesign,
 * which is incompatible with the ad-hoc identity ("-"). This script calls codesign
 * directly without --timestamp or --options runtime, avoiding the timestamp server
 * call that fails for ad-hoc (self-signed) identities.
 *
 * Invoked by electron-builder when build.mac.sign is set to this file.
 * Signature: (opts, packager) => Promise<void>
 *   opts.app       - absolute path to the staged .app bundle
 *   opts.identity  - signing identity (will be "-" for ad-hoc)
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Recursively collect all files inside a directory, deepest first.
 * Codesign requires nested bundles to be signed before their parents.
 */
function collectFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      // Don't follow symlinks — signing the target file is enough
      continue;
    }
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
      results.push(full); // directory itself (for nested .app bundles) — after children
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Attempt to sign a single path with ad-hoc identity.
 * Silently skips files codesign refuses (non-Mach-O resources, etc).
 */
function trySign(filePath) {
  try {
    execFileSync('codesign', [
      '--sign', '-',
      '--force',
      filePath
    ], { stdio: 'pipe' });
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    // Benign rejections — resource files, already-identical signatures, etc.
    if (
      stderr.includes('is not a Mach-O file') ||
      stderr.includes('bundle format unrecognized, invalid, or unsuitable') ||
      stderr.includes('no objects to sign') ||
      stderr.includes('is already signed') ||
      stderr.includes('not a Mach-O') ||
      stderr.includes('code object is not a bundle')
    ) {
      return;
    }
    // "resource fork" / "detritus" — strip xattrs and retry once
    if (stderr.includes('resource fork') || stderr.includes('detritus')) {
      try {
        execFileSync('xattr', ['-cr', filePath], { stdio: 'pipe' });
        execFileSync('codesign', ['--sign', '-', '--force', filePath], { stdio: 'pipe' });
        return;
      } catch {
        // Still failing — skip rather than abort the whole build
        return;
      }
    }
    // Unexpected error — log but don't abort (best-effort signing)
    console.warn(`[sign-adhoc] Warning: could not sign ${filePath}: ${stderr.trim()}`);
  }
}

/**
 * The function electron-builder calls when build.mac.sign is configured.
 *
 * @param {object} opts   - electron-builder sign options
 * @param {string} opts.app - path to the staged .app bundle
 */
module.exports = async function customSign(opts) {
  const appPath = opts.app;
  if (!appPath) {
    throw new Error('[sign-adhoc] opts.app is undefined — cannot sign');
  }
  console.log(`[sign-adhoc] Ad-hoc signing: ${appPath}`);

  // 1. Collect and sign all nested files first (deepest first)
  const allPaths = collectFiles(appPath);
  for (const p of allPaths) {
    trySign(p);
  }

  // 2. Aggressive recursive strip of extended attributes. Codesign rejects ANY
  // file with com.apple.FinderInfo, resource forks, or AppleDouble data (the
  // "detritus" in the error message). `xattr -cr` alone is unreliable on
  // macOS 15 — Spotlight + Finder + file-provider daemons re-add attrs while
  // codesign walks the tree. We run a find-driven per-file strip that's more
  // thorough, then also do an explicit FinderInfo deletion on every directory
  // (FinderInfo gets re-added to parent dirs as Finder accesses them).
  console.log('[sign-adhoc] Stripping extended attributes before final sign...');
  try {
    // Top-level recursive strip (catches most things)
    execFileSync('xattr', ['-cr', appPath], { stdio: 'pipe' });
    // Per-file strip via find — defends against partial strips on macOS 15
    execFileSync('/bin/sh', ['-c',
      `find "${appPath}" -exec xattr -c {} \\; 2>/dev/null || true`
    ], { stdio: 'pipe' });
    // Explicit FinderInfo + fileprovider deletion — these are the specific
    // attrs that cause "Finder information ... not allowed"
    execFileSync('/bin/sh', ['-c',
      `find "${appPath}" -exec xattr -d com.apple.FinderInfo {} \\; 2>/dev/null || true`
    ], { stdio: 'pipe' });
    execFileSync('/bin/sh', ['-c',
      `find "${appPath}" -exec xattr -d com.apple.fileprovider.fpfs#P {} \\; 2>/dev/null || true`
    ], { stdio: 'pipe' });
  } catch (err) {
    console.warn(`[sign-adhoc] Warning: xattr strip had errors: ${err.message}`);
  }

  // 3. Sign the top-level .app bundle last. Use a retry loop: if codesign fails
  // with "resource fork / Finder information / detritus", strip xattrs again
  // and retry. macOS 15's file-provider daemon can re-add FinderInfo between
  // our strip and codesign's walk, so a fresh strip immediately before retry
  // is the workaround.
  console.log(`[sign-adhoc] Signing top-level bundle: ${appPath}`);
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      execFileSync('codesign', [
        '--sign', '-',
        '--force',
        appPath
      ], { stdio: 'pipe' });
      console.log('[sign-adhoc] Done.');
      return;
    } catch (err) {
      lastError = err;
      const stderr = err.stderr ? err.stderr.toString() : '';
      if (stderr.includes('resource fork') || stderr.includes('detritus') || stderr.includes('Finder information')) {
        console.log(`[sign-adhoc] Attempt ${attempt} hit FinderInfo/detritus; re-stripping and retrying...`);
        try {
          execFileSync('xattr', ['-cr', appPath], { stdio: 'pipe' });
          execFileSync('/bin/sh', ['-c',
            `find "${appPath}" -exec xattr -d com.apple.FinderInfo {} \\; 2>/dev/null || true`
          ], { stdio: 'pipe' });
        } catch {
          // Continue to next retry
        }
        continue;
      }
      // Non-FinderInfo error — surface immediately
      throw err;
    }
  }
  // All retries exhausted
  throw lastError || new Error('[sign-adhoc] codesign failed after retries');
};
