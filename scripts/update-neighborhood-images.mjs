#!/usr/bin/env node

import fs from 'fs';

const NEIGHBORHOODS_FILE = 'src/data/neighborhoods.json';

// Image data for tier 1 neighborhoods
const IMAGE_DATA = {
  'old-fourth-ward': {
    imageUrl: '/images/neighborhoods/old-fourth-ward.webp',
    imageAlt: 'Historic Fourth Ward Park with Atlanta skyline in the background',
    imageCaption: 'Historic Fourth Ward Park connects Old Fourth Ward to the Atlanta BeltLine and downtown skyline.',
    imageCredit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  },
  'grant-park': {
    imageUrl: '/images/neighborhoods/grant-park.webp',
    imageAlt: 'Victorian homes on Augusta Avenue in Grant Park Atlanta',
    imageCaption: 'Augusta Avenue showcases the historic Victorian architecture that defines Grant Park.',
    imageCredit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  },
  'inman-park': {
    imageUrl: '/images/neighborhoods/inman-park.webp',
    imageAlt: 'Callan Castle historic Victorian mansion in Inman Park Atlanta',
    imageCaption: 'Callan Castle is one of the grand Victorian mansions that make Inman Park an architectural landmark.',
    imageCredit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  },
  'reynoldstown': {
    imageUrl: '/images/neighborhoods/reynoldstown.webp',
    imageAlt: 'Reynoldstown neighborhood street scene in Atlanta',
    imageCaption: 'Reynoldstown blends historic charm with modern development along the BeltLine.',
    imageCredit: 'Photo: Wikimedia Commons (CC BY-SA 3.0)'
  },
  'cabbagetown': {
    imageUrl: '/images/neighborhoods/cabbagetown.webp',
    imageAlt: 'Cabbagetown Park green space in Atlanta historic mill district',
    imageCaption: 'Cabbagetown Park provides green space in this historic cotton mill neighborhood.',
    imageCredit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  },
  'summerhill': {
    imageUrl: '/images/neighborhoods/summerhill.webp',
    imageAlt: 'Summerhill neighborhood view near downtown Atlanta',
    imageCaption: 'Summerhill sits just south of downtown Atlanta near Georgia State Stadium.',
    imageCredit: 'Photo: Panoramio / Wikimedia Commons (CC BY 3.0)'
  },
  'east-atlanta-village': {
    imageUrl: '/images/neighborhoods/east-atlanta-village.webp',
    imageAlt: 'East Atlanta Village commercial district with local shops and restaurants',
    imageCaption: 'East Atlanta Village is the walkable heart of the East Atlanta neighborhood.',
    imageCredit: 'Photo: Wikimedia Commons (CC BY-SA 3.0)'
  },
  'ormewood-park': {
    imageUrl: '/images/neighborhoods/ormewood-park.webp',
    imageAlt: 'Brownwood Park green space in Ormewood Park Atlanta',
    imageCaption: 'Brownwood Park anchors the Ormewood Park neighborhood with sports fields and greenery.',
    imageCredit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  },
  'kirkwood': {
    imageUrl: '/images/neighborhoods/kirkwood.webp',
    imageAlt: 'Historic downtown Kirkwood Atlanta circa 1954',
    imageCaption: 'Historic downtown Kirkwood has maintained its small-town character since the 1950s.',
    imageCredit: 'Photo: Wikimedia Commons (Public Domain)'
  },
  'peoplestown': {
    imageUrl: '/images/neighborhoods/peoplestown.webp',
    imageAlt: 'Peoplestown neighborhood in southeast Atlanta',
    imageCaption: 'Peoplestown is a historic neighborhood south of downtown Atlanta undergoing revitalization.',
    imageCredit: 'Photo: Wikimedia Commons (CC BY-SA 4.0)'
  }
};

// Read and parse neighborhoods.json
const data = JSON.parse(fs.readFileSync(NEIGHBORHOODS_FILE, 'utf8'));

let updated = 0;

// Update each neighborhood with matching image data
data.neighborhoods = data.neighborhoods.map(neighborhood => {
  const imageData = IMAGE_DATA[neighborhood.slug];
  if (imageData) {
    updated++;
    console.log(`✓ Adding image to: ${neighborhood.name}`);
    return {
      ...neighborhood,
      ...imageData
    };
  }
  return neighborhood;
});

// Write back to file
fs.writeFileSync(NEIGHBORHOODS_FILE, JSON.stringify(data, null, 2));

console.log(`\nUpdated ${updated} neighborhoods with images.`);
