#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import https from 'https';
import sharp from 'sharp';

const IMAGES_DIR = 'public/images/neighborhoods';

const TIER2_IMAGES = [
  {
    slug: 'midtown',
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Skyline_view_of_Midtown_Atlanta_from_the_Skyline_Garden_at_the_Atlanta_Botanical_Garden.jpg',
    alt: 'Midtown Atlanta skyline view from the Atlanta Botanical Garden',
    caption: 'Midtown Atlanta is the city\'s arts and business district, home to the High Museum and Piedmont Park.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  },
  {
    slug: 'downtown',
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/f9/Centenial_olympic_park_downtown_Atlanta.jpg',
    alt: 'Downtown Atlanta skyline from Centennial Olympic Park',
    caption: 'Downtown Atlanta anchors the city with Centennial Olympic Park, Georgia Aquarium, and World of Coca-Cola.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 3.0)'
  },
  {
    slug: 'little-five-points',
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Panorama_of_the_Little_Five_Points_business_district.jpg',
    alt: 'Panoramic view of the Little Five Points business district in Atlanta',
    caption: 'Little Five Points is Atlanta\'s bohemian heart, known for vintage shops, street art, and live music venues.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  },
  {
    slug: 'virginia-highland',
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/VaHiPanorama.jpg',
    alt: 'Panoramic view of Virginia-Highland neighborhood in Atlanta',
    caption: 'Virginia-Highland features charming 1920s bungalows and a walkable restaurant and shopping district.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 3.0)'
  },
  {
    slug: 'candler-park',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/db/Candler_Park_Atlanta.jpg',
    alt: 'Candler Park neighborhood green space in Atlanta',
    caption: 'Candler Park is a leafy, family-friendly neighborhood adjacent to Little Five Points with a popular park.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 3.0)'
  },
  {
    slug: 'poncey-highland',
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Ponce_City_Market_from_Historic_Fourth_Ward_Park.jpg',
    alt: 'Ponce City Market viewed from Historic Fourth Ward Park along the BeltLine',
    caption: 'Poncey-Highland is home to Ponce City Market, a major BeltLine destination with shops and restaurants.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  },
  {
    slug: 'sweet-auburn',
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/35/Historic_Ebenezer_Baptist_Church_in_Atlanta%2C_June_2015.jpg',
    alt: 'Historic Ebenezer Baptist Church in Sweet Auburn, Atlanta',
    caption: 'Sweet Auburn is the historic heart of Black Atlanta and home to Ebenezer Baptist Church where MLK preached.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  },
  {
    slug: 'west-end',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/db/Hammonds_House_Museum_located_in_Atlanta%2C_GA_in_the_historic_West_End_neighborhood.jpg',
    alt: 'Hammonds House Museum in the historic West End neighborhood of Atlanta',
    caption: 'West End is one of Atlanta\'s oldest neighborhoods, now connected to the Westside BeltLine trail.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  },
  {
    slug: 'decatur',
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/14/Decatur_Square.JPG',
    alt: 'Decatur Square with local shops and restaurants in downtown Decatur Georgia',
    caption: 'Decatur is a walkable city east of Atlanta known for excellent schools and a vibrant downtown square.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 3.0)'
  },
  {
    slug: 'edgewood',
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7a/Atlanta_Streetcar_on_a_mid-morning_run_heading_east_on_Edgewood_Avenue.jpg',
    alt: 'Atlanta Streetcar on Edgewood Avenue in the Edgewood neighborhood',
    caption: 'Edgewood offers easy transit access and a growing food and bar scene along Edgewood Avenue.',
    credit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  }
];

async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'AtlantaNewsBot/1.0 (contact@atlantanewsandtalk.com)'
      }
    };

    https.get(url, options, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadImage(response.headers.location).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

async function processImage(imageData) {
  const { slug, url, alt, caption, credit } = imageData;
  const outputPath = path.join(IMAGES_DIR, `${slug}.webp`);

  console.log(`📥 Downloading ${slug}...`);

  try {
    const imageBuffer = await downloadImage(url);

    await sharp(imageBuffer)
      .resize(1200, 800, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toFile(outputPath);

    console.log(`  ✓ Saved ${outputPath}`);
    return { slug, imageUrl: `/images/neighborhoods/${slug}.webp`, imageAlt: alt, imageCaption: caption, imageCredit: credit };
  } catch (error) {
    console.error(`  ✗ Failed: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('Downloading Tier 2 neighborhood images from Wikimedia Commons...\n');

  const results = [];

  for (const imageData of TIER2_IMAGES) {
    const result = await processImage(imageData);
    if (result) results.push(result);
    await new Promise(r => setTimeout(r, 1500)); // Rate limit
  }

  console.log(`\n✓ Downloaded ${results.length}/${TIER2_IMAGES.length} images`);

  // Update neighborhoods.json
  if (results.length > 0) {
    const dataFile = 'src/data/neighborhoods.json';
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

    for (const result of results) {
      const neighborhood = data.neighborhoods.find(n => n.slug === result.slug);
      if (neighborhood) {
        neighborhood.imageUrl = result.imageUrl;
        neighborhood.imageAlt = result.imageAlt;
        neighborhood.imageCaption = result.imageCaption;
        neighborhood.imageCredit = result.imageCredit;
        console.log(`✓ Updated ${result.slug}`);
      }
    }

    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    console.log('\n✓ Updated neighborhoods.json');
  }
}

main().catch(console.error);
