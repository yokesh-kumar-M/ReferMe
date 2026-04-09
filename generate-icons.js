const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sourceImage = process.argv[2];
const publicDir = path.join(__dirname, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

async function generateIcons() {
  try {
    const img = sharp(sourceImage);

    // Chrome Extension Icons
    await img.resize(16, 16).toFile(path.join(publicDir, 'icon16.png'));
    await img.resize(48, 48).toFile(path.join(publicDir, 'icon48.png'));
    await img.resize(128, 128).toFile(path.join(publicDir, 'icon128.png'));

    // Web App Icons
    await img.resize(192, 192).toFile(path.join(publicDir, 'icon-192.png'));
    await img.resize(512, 512).toFile(path.join(publicDir, 'icon-512.png'));
    
    // Apple Touch Icon
    await img.resize(180, 180).toFile(path.join(publicDir, 'apple-touch-icon.png'));

    console.log('✅ All icons generated successfully in the public/ directory.');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
