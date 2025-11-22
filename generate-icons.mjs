import sharp from 'sharp';
import fs from 'fs';

const svgBuffer = fs.readFileSync('./public/icon.svg');

async function generateIcons() {
  try {
    // Generate 192x192 icon
    await sharp(svgBuffer)
      .resize(192, 192)
      .png()
      .toFile('./public/icon-192.png');
    console.log('✓ Generated icon-192.png');

    // Generate 512x512 icon
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile('./public/icon-512.png');
    console.log('✓ Generated icon-512.png');

    // Generate Apple touch icon (180x180)
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile('./public/apple-touch-icon.png');
    console.log('✓ Generated apple-touch-icon.png');

    // Generate favicon
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile('./public/favicon.png');
    console.log('✓ Generated favicon.png');

    console.log('\n🎉 All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
