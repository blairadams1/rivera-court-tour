import { encodeToKTX2 } from 'ktx2-encoder';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const MURALS = [
  'NorthWall4.webp',
  'SouthWall4c.webp',
  'EastWallTransparent4.webp',
  'WestWall5.webp'
];

async function convertMural(fileName, useUASTC = true) {
  const inputPath = path.join('public', fileName);
  const baseName = path.basename(fileName, path.extname(fileName));
  const outputPath = path.join('public', `${baseName}.ktx2`);

  console.log(`\n--------------------------------------------`);
  console.log(`Processing: ${fileName}`);
  console.log(`Input path: ${inputPath}`);
  console.log(`Output path: ${outputPath}`);

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found at ${inputPath}`);
    return;
  }

  const webpBuffer = fs.readFileSync(inputPath);
  const start = Date.now();

  try {
    console.log(`Encoding to KTX2 (${useUASTC ? 'UASTC' : 'ETC1S'})...`);
    const ktx2Data = await encodeToKTX2(webpBuffer, {
      imageDecoder: async (buffer) => {
        const { data, info } = await sharp(buffer)
          .raw()
          .ensureAlpha()
          .toBuffer({ resolveWithObject: true });

        console.log(`  Decoded image size: ${info.width}x${info.height}`);
        return {
          data: new Uint8Array(data),
          width: info.width,
          height: info.height
        };
      },
      isUASTC: useUASTC,
      generateMipmap: true,
      qualityLevel: 128, // Only for ETC1S (1-255)
      compressionLevel: 1, // Only for ETC1S (0-5, faster encoding)
    });

    fs.writeFileSync(outputPath, Buffer.from(ktx2Data));

    const duration = ((Date.now() - start) / 1000).toFixed(1);
    const origSize = (fs.statSync(inputPath).size / 1024 / 1024).toFixed(2);
    const ktx2Size = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);

    console.log(`Finished in ${duration}s!`);
    console.log(`File size: ${origSize}MB WebP -> ${ktx2Size}MB KTX2`);
  } catch (err) {
    console.error(`Error encoding ${fileName}:`, err);
  }
}

async function run() {
  const useUASTC = process.argv.includes('--etc1s') ? false : true;
  console.log(`Starting KTX2 conversion using ${useUASTC ? 'UASTC' : 'ETC1S'}...`);
  
  for (const mural of MURALS) {
    await convertMural(mural, useUASTC);
  }
  
  console.log('\nAll murals processed!');
}

run();
