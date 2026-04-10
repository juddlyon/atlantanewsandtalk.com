#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import https from 'https';
import sharp from 'sharp';

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const IMAGES_DIR = 'public/images/neighborhoods';

if (!PEXELS_API_KEY) {
  console.error('Error: PEXELS_API_KEY environment variable not set');
  console.error('Run: export PEXELS_API_KEY=your_key_here');
  process.exit(1);
}

// Search terms optimized for each neighborhood
const TIER2_NEIGHBORHOODS = [
  {
    slug: 'midtown',
    search: 'Atlanta Midtown skyline',
    alt: 'Midtown Atlanta skyline with modern high-rise buildings',
    caption: 'Midtown Atlanta is the city\'s arts and business district, home to the High Museum and Piedmont Park.',
    credit: 'Photo: Pexels'
  },
  {
    slug: 'downtown',
    search: 'Downtown Atlanta Centennial Park',
    alt: 'Downtown Atlanta skyline view from Centennial Olympic Park',
    caption: 'Downtown Atlanta anchors the city with major attractions like the Georgia Aquarium and World of Coca-Cola.',
    credit: 'Photo: Pexels'
  },
  {
    slug: 'candler-park',
    search: 'Atlanta park trees neighborhood',
    alt: 'Tree-lined streets in Candler Park Atlanta neighborhood',
    caption: 'Candler Park is a leafy, family-friendly neighborhood adjacent to Little Five Points.',
    credit: 'Photo: Pexels'
  },
  {
    slug: 'little-five-points',
    search: 'Atlanta street art murals colorful',
    alt: 'Colorful street art and murals in Little Five Points Atlanta',
    caption: 'Little Five Points is Atlanta\'s bohemian heart, known for street art, vintage shops, and live music.',
    credit: 'Photo: Pexels'
  },
  {
    slug: 'poncey-highland',
    search: 'Atlanta Ponce City Market BeltLine',
    alt: 'Ponce City Market along the Atlanta BeltLine in Poncey-Highland',
    caption: 'Poncey-Highland is home to Ponce City Market, a major BeltLine destination.',
    credit: 'Photo: Pexels'
  },
  {
    slug: 'virginia-highland',
    search: 'Atlanta bungalow house neighborhood',
    alt: 'Historic bungalow homes in Virginia-Highland Atlanta',
    caption: 'Virginia-Highland features charming 1920s bungalows and a walkable restaurant district.',
    credit: 'Photo: Pexels'
  },
  {
    slug: 'edgewood',
    search: 'Atlanta MARTA train station',
    alt: 'Edgewood neighborhood near MARTA transit in Atlanta',
    caption: 'Edgewood offers easy MARTA access and a growing food and bar scene on Edgewood Avenue.',
    credit: 'Photo: Pexels'
  },
  {
    slug: 'sweet-auburn',
    search: 'Atlanta Martin Luther King historic',
    alt: 'Historic Sweet Auburn district in Atlanta, birthplace of Martin Luther King Jr.',
    caption: 'Sweet Auburn is the historic heart of Black Atlanta and birthplace of Dr. Martin Luther King Jr.',
    credit: 'Photo: Pexels'
  },
  {
    slug: 'west-end',
    search: 'Atlanta West End historic neighborhood',
    alt: 'Historic West End neighborhood in Atlanta',
    caption: 'West End is one of Atlanta\'s oldest neighborhoods, now connected to the Westside BeltLine.',
    credit: 'Photo: Pexels'
  },
  {
    slug: 'decatur',
    search: 'Decatur Georgia downtown square',
    alt: 'Downtown Decatur square with local shops and restaurants',
    caption: 'Decatur is a walkable city east of Atlanta known for great schools and a vibrant downtown square.',
    credit: 'Photo: Pexels'
  }
];

async function searchPexels(query) {
  return new Promise((resolve, reject) => {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;

    const options = {
      headers: {
        'Authorization': PEXELS_API_KEY
      }
    };

    https.get(url, options, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.photos || []);
        } catch (e) {
          reject(e);
        }
      });
      response.on('error', reject);
    }).on('error', reject);
  });
}

async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadImage(response.headers.location).then(resolve).catch(reject);
      }

      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

async function processNeighborhood(neighborhood) {
  const { slug, search, alt, caption, credit } = neighborhood;
  const outputPath = path.join(IMAGES_DIR, `${slug}.webp`);

  // Skip if image already exists
  if (fs.existsSync(outputPath)) {
    console.log(`⏭ ${slug}: already has image`);
    return null;
  }

  console.log(`🔍 ${slug}: searching "${search}"...`);

  try {
    const photos = await searchPexels(search);

    if (photos.length === 0) {
      console.log(`  ✗ No photos found`);
      return null;
    }

    // Use the first landscape photo
    const photo = photos[0];
    const imageUrl = photo.src.large2x || photo.src.large;

    console.log(`  📥 Downloading from Pexels (by ${photo.photographer})...`);
    const imageBuffer = await downloadImage(imageUrl);

    // Convert to WebP
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
      imageCredit: `${credit} (${photo.photographer})`
    };
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
    return null;
  }
}

async function updateNeighborhoodsJson(results) {
  const dataFile = 'src/data/neighborhoods.json';
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

  for (const result of results) {
    if (!result) continue;

    const neighborhood = data.neighborhoods.find(n => n.slug === result.slug);
    if (neighborhood) {
      neighborhood.imageUrl = result.imageUrl;
      neighborhood.imageAlt = result.imageAlt;
      neighborhood.imageCaption = result.imageCaption;
      neighborhood.imageCredit = result.imageCredit;
      console.log(`✓ Updated ${result.slug} in neighborhoods.json`);
    }
  }

  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

async function main() {
  console.log('Downloading Tier 2 neighborhood images from Pexels...\n');

  const results = [];

  for (const neighborhood of TIER2_NEIGHBORHOODS) {
    const result = await processNeighborhood(neighborhood);
    results.push(result);
    // Rate limit
    await new Promise(r => setTimeout(r, 1000));
  }

  const successful = results.filter(r => r !== null);
  console.log(`\n✓ Downloaded ${successful.length}/${TIER2_NEIGHBORHOODS.length} images`);

  if (successful.length > 0) {
    console.log('\nUpdating neighborhoods.json...');
    await updateNeighborhoodsJson(successful);
  }
}

main().catch(console.error);
