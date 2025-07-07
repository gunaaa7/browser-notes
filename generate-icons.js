const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
  const svgPath = path.join(__dirname, 'src', 'icons', 'icon.svg');
  const iconsDir = path.join(__dirname, 'src', 'icons');
  
  // Read SVG file
  const svgBuffer = fs.readFileSync(svgPath);
  
  // Generate PNG files for different sizes
  const sizes = [16, 32, 48, 128];
  
  for (const size of sizes) {
    const outputPath = path.join(iconsDir, `icon${size}.png`);
    
    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`Generated ${outputPath}`);
    } catch (error) {
      console.error(`Error generating ${size}x${size} icon:`, error);
    }
  }
  
  console.log('Icon generation complete!');
}

generateIcons().catch(console.error); 