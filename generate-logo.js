const fs = require('fs');
const sharp = require('sharp');
const path = require('path');
const { execSync } = require('child_process');

const svgPath = path.join(__dirname, 'logo.svg');
const sourcePngPath = path.join(__dirname, 'source-logo.png');

const svgCode = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#312e81" />
    </linearGradient>
    <linearGradient id="spark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#c7d2fe" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="40" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  
  <rect width="1024" height="1024" rx="256" fill="url(#bg)" />
  
  <g transform="translate(512, 512) scale(0.85) translate(-512, -512)" filter="url(#glow)">
    <path d="M512 150 C512 350, 674 512, 874 512 C674 512, 512 674, 512 874 C512 674, 350 512, 150 512 C350 512, 512 350, 512 150 Z" fill="url(#spark)" />
  </g>
</svg>
`;

fs.writeFileSync(svgPath, svgCode);

sharp(svgPath)
  .png()
  .toFile(sourcePngPath)
  .then(() => {
    console.log('Created source-logo.png');
    execSync(`node generate-icons.js source-logo.png`, { cwd: __dirname, stdio: 'inherit' });
  })
  .catch(err => {
    console.error('Error:', err);
  });
