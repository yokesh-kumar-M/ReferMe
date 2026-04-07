const fs = require('fs');
const path = require('path');

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
