#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import https from 'https';
import sharp from 'sharp';

const IMAGES_DIR = 'public/images/neighborhoods';

// Tier 1 neighborhood images from Wikimedia Commons
const NEIGHBORHOOD_IMAGES = [
  {
    slug: 'old-fourth-ward',
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/27/Historic_Fourth_Ward_Park%2C_2021.jpg',
    alt: 'Historic Fourth Ward Park with Atlanta skyline in the background',
    caption: 'Historic Fourth Ward Park connects Old Fourth Ward to the Atlanta BeltLine and downtown skyline.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  },
  {
    slug: 'grant-park',
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Augusta_Avenue%2C_Grant_Park%2C_Atlanta%2C_GA.jpg',
    alt: 'Victorian homes on Augusta Avenue in Grant Park Atlanta',
    caption: 'Augusta Avenue showcases the historic Victorian architecture that defines Grant Park.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  },
  {
    slug: 'inman-park',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Callan_Castle%2C_Inman_Park%2C_Atlanta%2C_GA.jpg',
    alt: 'Callan Castle historic Victorian mansion in Inman Park Atlanta',
    caption: 'Callan Castle is one of the grand Victorian mansions that make Inman Park an architectural landmark.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  },
  {
    slug: 'reynoldstown',
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Reynoldstown.jpg',
    alt: 'Reynoldstown neighborhood street scene in Atlanta',
    caption: 'Reynoldstown blends historic charm with modern development along the BeltLine.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 3.0)'
  },
  {
    slug: 'cabbagetown',
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Cabbagetown_Park%2C_Cabbagetown%2C_Atlanta%2C_GA.jpg',
    alt: 'Cabbagetown Park green space in Atlanta historic mill district',
    caption: 'Cabbagetown Park provides green space in this historic cotton mill neighborhood.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  },
  {
    slug: 'summerhill',
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Summerhill%2C_Atlanta%2C_GA%2C_USA_-_panoramio_%284%29.jpg',
    alt: 'Summerhill neighborhood view near downtown Atlanta',
    caption: 'Summerhill sits just south of downtown Atlanta near Georgia State Stadium.',
    credit: 'Photo: Panoramio / Wikimedia Commons (CC BY 3.0)'
  },
  {
    slug: 'east-atlanta-village',
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/53/East_Atlanta_Village.jpg',
    alt: 'East Atlanta Village commercial district with local shops and restaurants',
    caption: 'East Atlanta Village is the walkable heart of the East Atlanta neighborhood.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 3.0)'
  },
  {
    slug: 'ormewood-park',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Brownwood_Park.jpg',
    alt: 'Brownwood Park green space in Ormewood Park Atlanta',
    caption: 'Brownwood Park anchors the Ormewood Park neighborhood with sports fields and greenery.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  },
  {
    slug: 'kirkwood',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/db/Downtown_Kirkwood_circa_1954.jpg',
    alt: 'Historic downtown Kirkwood Atlanta circa 1954',
    caption: 'Historic downtown Kirkwood has maintained its small-town character since the 1950s.',
    credit: 'Photo: Wikimedia Commons (Public Domain)'
  },
  {
    slug: 'peoplestown',
    url: 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Peoplestown_in_SE_ATL.jpg',
    alt: 'Peoplestown neighborhood in southeast Atlanta',
    caption: 'Peoplestown is a historic neighborhood south of downtown Atlanta undergoing revitalization.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  }
];

// Ensure output directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'AtlantaNewsBot/1.0 (contact@atlantanewsandtalk.com)'
      }
    };

    https.get(url, options, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadImage(response.headers.location, outputPath).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }

      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('image')) {
        reject(new Error(`Not an image: ${contentType}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      response.on('error', reject);
    }).on('error', reject);
  });
}

async function processImage(imageData) {
  const { slug, url, alt, caption, credit } = imageData;
  const outputPath = path.join(IMAGES_DIR, `${slug}.webp`);

  console.log(`Downloading ${slug}...`);

  try {
    const imageBuffer = await downloadImage(url, outputPath);

    // Convert to WebP with sharp
    await sharp(imageBuffer)
      .resize(1200, 800, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toFile(outputPath);

    console.log(`  ✓ Saved ${outputPath}`);
    return {
      slug,
      imageUrl: `/images/neighborhoods/${slug}.webp`,
      imageAlt: alt,
      imageCaption: caption,
      imageCredit: credit
    };
  } catch (error) {
    console.error(`  ✗ Failed: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('Downloading neighborhood images...\n');

  const results = [];

  for (const imageData of NEIGHBORHOOD_IMAGES) {
    const result = await processImage(imageData);
    if (result) {
      results.push(result);
    }
    // Add delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\nDownloaded ${results.length}/${NEIGHBORHOOD_IMAGES.length} images`);

  // Output JSON for updating neighborhoods.json
  console.log('\nImage data for neighborhoods.json:');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
