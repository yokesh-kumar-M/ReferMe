const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

console.log("1. Building Next.js app...");
execSync('npm run build', { stdio: 'inherit' });

console.log("\n2. Fixing paths in out/ directory for Chrome Extension compatibility...");
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.html') || fullPath.endsWith('.css') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      content = content.replace(/\/_next\//g, './_next/');
      content = content.replace(/\/_next\//g, './_next/');
      content = content.replace(/href="\/favicon/g, 'href="./favicon');
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
