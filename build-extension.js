const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

console.log("1. Building Next.js app...");
execSync('npm run build', { stdio: 'inherit' });

console.log("\n2. Fixing paths in out/ directory for Chrome Extension compatibility...");

const outDir = path.join(__dirname, 'out');
const nextDir = path.join(outDir, '_next');
const assetsDir = path.join(outDir, 'assets');

// Chrome does not allow extensions with folders starting with "_" like _next
if (fs.existsSync(nextDir)) {
  fs.renameSync(nextDir, assetsDir);
  console.log("Renamed _next directory to assets.");
}

// Remove any file or directory starting with "_" because Chrome extensions do not allow files starting with "_"
const outFiles = fs.readdirSync(outDir);
for (const file of outFiles) {
  if (file.startsWith('_') && file !== 'assets') {
    const fullPath = path.join(outDir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
    console.log(`Removed reserved system file: ${file}`);
  }
}

function processDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.html') || fullPath.endsWith('.css') || fullPath.endsWith('.js') || fullPath.endsWith('.json')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Update Next.js paths to use the new assets folder
      content = content.replace(/\/_next\//g, './assets/');
      content = content.replace(/_next\//g, 'assets/');
      content = content.replace(/"\/_next\//g, '"./assets/');
      
      // General relative path fixing for Chrome Extensions
      content = content.replace(/href="\/favicon/g, 'href="./favicon');
      content = content.replace(/'\/pdf\.worker\.min\.mjs'/g, "'./pdf.worker.min.mjs'");
      content = content.replace(/"\/pdf\.worker\.min\.mjs"/g, '"./pdf.worker.min.mjs"');

      // EXTRACT INLINE SCRIPTS (Fix for Chrome Extension Manifest V3 CSP)
      if (fullPath.endsWith('.html')) {
        const inlineScripts = [];
        // Match <script>...</script> but ignore those with a src attribute
        const scriptRegex = /<script(?![^>]*src=)[^>]*>(.*?)<\/script>/gis;
        
        content = content.replace(scriptRegex, (match, scriptContent) => {
          inlineScripts.push(scriptContent);
          return ''; // Remove the inline script from the HTML
        });

        if (inlineScripts.length > 0) {
          const combinedScript = inlineScripts.join('\n;\n');
          const scriptFileName = `inline-scripts-${path.basename(fullPath, '.html')}.js`;
          const scriptPath = path.join(dir, scriptFileName);
          fs.writeFileSync(scriptPath, combinedScript);
          
          // Inject the externalized script right before </body>, or at the end if no </body>
          const scriptTag = `<script src="./${scriptFileName}"></script>`;
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

console.log("\n3. Zipping extension...");
const output = fs.createWriteStream('extension.zip');
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', function() {
  console.log(`\n✅ Success! The Chrome Extension is ready: extension.zip (${archive.pointer()} bytes)`);
  console.log("Upload 'extension.zip' or the 'out' directory to the Chrome Web Store to publish.");
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);
archive.directory('out/', false);
archive.finalize();
