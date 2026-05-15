const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

console.log("1. Building Next.js app (static export for extension)...");
execSync('npm run build', {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, BUILD_STATIC: '1' },
});

const outDir = path.join(__dirname, 'out');

if (!fs.existsSync(outDir)) {
  console.error("ERROR: 'out/' directory not found. Make sure next.config.js has output: 'export' when BUILD_STATIC=1.");
  process.exit(1);
}

console.log("\n2. Fixing paths in out/ directory for Chrome Extension compatibility...");

const nextDir = path.join(outDir, '_next');
const assetsDir = path.join(outDir, 'assets');

// Chrome does not allow extensions with folders starting with "_" like _next
if (fs.existsSync(nextDir)) {
  fs.renameSync(nextDir, assetsDir);
  console.log("Renamed _next directory to assets.");
}

// Chrome extensions reject files starting with "_" anywhere in the package.
// Walk the entire tree and remove them, plus the Next.js .txt metadata files
// that ship alongside every HTML page (they aren't needed at runtime and
// often contain "_"-prefixed segments).
function cleanReservedFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const isDir = fs.statSync(fullPath).isDirectory();

    // Skip the renamed assets directory; everything inside is safe.
    if (entry === 'assets' && dir === outDir) continue;

    if (entry.startsWith('_')) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`Removed reserved file: ${path.relative(outDir, fullPath)}`);
      continue;
    }

    // Drop the Next.js RSC payload .txt files — Chrome flags them and
    // they contain stale references to /_next/ paths anyway.
    if (!isDir && entry.endsWith('.txt')) {
      fs.unlinkSync(fullPath);
      continue;
    }

    if (isDir) {
      cleanReservedFiles(fullPath);
      // Drop any directory left empty after cleanup (e.g. /popup which only
      // contained Next.js _-prefixed metadata files).
      try {
        if (fs.readdirSync(fullPath).length === 0) fs.rmdirSync(fullPath);
      } catch { /* ignore */ }
    }
  }
}
cleanReservedFiles(outDir);

function processDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.html') || fullPath.endsWith('.css') || fullPath.endsWith('.js') || fullPath.endsWith('.json')) {
      let content = fs.readFileSync(fullPath, 'utf8');

      // Update Next.js paths to use the new assets folder with ABSOLUTE extension paths (/)
      content = content.replace(/\/_next\//g, '/assets/');
      content = content.replace(/_next\//g, 'assets/');

      // General path fixing for Chrome Extensions
      content = content.replace(/href="\/favicon/g, 'href="/favicon');
      content = content.replace(/'\/pdf\.worker\.min\.mjs'/g, "'/pdf.worker.min.mjs'");
      content = content.replace(/"\/pdf\.worker\.min\.mjs"/g, '"/pdf.worker.min.mjs"');

      // EXTRACT INLINE SCRIPTS (Fix for Chrome Extension Manifest V3 CSP)
      if (fullPath.endsWith('.html')) {
        const inlineScripts = [];
        const scriptRegex = /<script(?![^>]*src=)[^>]*>(.*?)<\/script>/gis;

        content = content.replace(scriptRegex, (match, scriptContent) => {
          inlineScripts.push(scriptContent);
          return '';
        });

        if (inlineScripts.length > 0) {
          const combinedScript = inlineScripts.join('\n;\n');
          const scriptFileName = `inline-scripts-${path.basename(fullPath, '.html')}.js`;
          const scriptPath = path.join(dir, scriptFileName);
          fs.writeFileSync(scriptPath, combinedScript);

          const scriptTag = `<script src="/${scriptFileName}"></script>`;
          if (content.includes('</body>')) {
            content = content.replace('</body>', `${scriptTag}</body>`);
          } else {
            content += scriptTag;
          }
        }
      }

      fs.writeFileSync(fullPath, content);
    }
  }
}
processDirectory('./out');

console.log("\n3. Writing timestamp for dev hot-reload (no-op in production)...");
// The new background.js is always shipped — it routes content<->popup messages.
// In dev builds we additionally write timestamp.json so background.js can poll
// for it and reload the extension when the build is regenerated.
if (process.env.NODE_ENV !== 'production') {
  fs.writeFileSync(path.join(__dirname, 'out', 'timestamp.json'), JSON.stringify({ timestamp: Date.now() }));
}

console.log("\n4. Zipping extension...");
const output = fs.createWriteStream('extension.zip');
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', function() {
  console.log(`\n✅ Extension ready: extension.zip (${archive.pointer()} bytes)`);
  console.log("Load the 'out/' directory in Chrome via chrome://extensions > Load unpacked");
  console.log("Or upload 'extension.zip' to the Chrome Web Store.");
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);
archive.directory('out/', false);
archive.finalize();
