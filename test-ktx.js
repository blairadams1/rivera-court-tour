import { encodeToKTX2 } from 'ktx2-encoder';
import fs from 'fs';
import sharp from 'sharp';

async function test() {
  try {
    console.log('Reading WebP file...');
    const webpBuffer = fs.readFileSync('public/NorthWall4.webp');
    
    console.log('Encoding WebP buffer to KTX2 (UASTC)...');
    const ktx2Data = await encodeToKTX2(webpBuffer, {
      imageDecoder: async (buffer) => {
        const { data, info } = await sharp(buffer)
          .raw()
          .ensureAlpha() // Ensure RGBA
          .toBuffer({ resolveWithObject: true });
        
        return {
          data: new Uint8Array(data),
          width: info.width,
          height: info.height,
        };
      },
      isUASTC: true, // Try UASTC first (highest quality)
      generateMipmap: true,
    });
    
    fs.writeFileSync('public/NorthWall4.ktx2', Buffer.from(ktx2Data));
    const originalSize = (fs.statSync('public/NorthWall4.webp').size / 1024 / 1024).toFixed(2);
    const ktx2Size = (fs.statSync('public/NorthWall4.ktx2').size / 1024 / 1024).toFixed(2);
    console.log(`Success! WebP size: ${originalSize}MB -> KTX2 size: ${ktx2Size}MB`);
  } catch (err) {
    console.error('Error during test:', err);
  }
}
test();
