#!/usr/bin/env node

import fs from 'fs';

const NEIGHBORHOODS_FILE = 'src/data/neighborhoods.json';

// Neighborhoods to KEEP with their new tiers
const KEEP_NEIGHBORHOODS = {
  // Tier 1 - SE BeltLine Core
  'old-fourth-ward': 1,
  'inman-park': 1,
  'reynoldstown': 1,
  'cabbagetown': 1,
  'grant-park': 1,
  'east-atlanta': 1,  // Will merge EAV into this
  'ormewood-park': 1,
  'kirkwood': 1,
  'summerhill': 1,
  'peoplestown': 1,

  // Tier 2 - Adjacent ITP
  'midtown': 2,
  'downtown': 2,
  'candler-park': 2,
  'little-five-points': 2,
  'poncey-highland': 2,
  'virginia-highland': 2,
  'edgewood': 2,
  'sweet-auburn': 2,
  'west-end': 2,
  'decatur': 2,
};

// Read current data
const data = JSON.parse(fs.readFileSync(NEIGHBORHOODS_FILE, 'utf8'));

// Find East Atlanta Village to merge its data into East Atlanta
const eav = data.neighborhoods.find(n => n.slug === 'east-atlanta-village');
const eastAtlanta = data.neighborhoods.find(n => n.slug === 'east-atlanta');

if (eav && eastAtlanta) {
  // Merge EAV highlights and description elements into East Atlanta
  console.log('Merging East Atlanta Village into East Atlanta...');

  // Transfer image from EAV to East Atlanta if East Atlanta doesn't have one
  if (eav.imageUrl && !eastAtlanta.imageUrl) {
    eastAtlanta.imageUrl = eav.imageUrl;
    eastAtlanta.imageAlt = eav.imageAlt;
    eastAtlanta.imageCaption = eav.imageCaption;
    eastAtlanta.imageCredit = eav.imageCredit;
  }

  // Add EAV highlights that aren't duplicates
  const existingHighlights = new Set(eastAtlanta.highlights || []);
  for (const highlight of (eav.highlights || [])) {
    if (!existingHighlights.has(highlight)) {
      eastAtlanta.highlights.push(highlight);
    }
  }

  // Update description to mention EAV as the commercial heart
  if (!eastAtlanta.description.includes('East Atlanta Village')) {
    eastAtlanta.description = eastAtlanta.description.replace(
      'East Atlanta is',
      'East Atlanta, anchored by the commercial district known as <strong>East Atlanta Village (EAV)</strong>, is'
    );
  }
}

// Filter to only keep the neighborhoods we want
const filteredNeighborhoods = data.neighborhoods.filter(n => {
  const slug = n.slug;

  // Skip East Atlanta Village (merged into East Atlanta)
  if (slug === 'east-atlanta-village') {
    console.log(`  Removing: East Atlanta Village (merged into East Atlanta)`);
    return false;
  }

  // Check if in keep list
  if (KEEP_NEIGHBORHOODS[slug] !== undefined) {
    return true;
  }

  console.log(`  Removing: ${n.name}`);
  return false;
});

// Update tiers for kept neighborhoods
for (const neighborhood of filteredNeighborhoods) {
  const newTier = KEEP_NEIGHBORHOODS[neighborhood.slug];
  if (newTier && neighborhood.tier !== newTier) {
    console.log(`  Updating tier: ${neighborhood.name} (${neighborhood.tier} → ${newTier})`);
    neighborhood.tier = newTier;
  }
}

// Sort by tier, then alphabetically
filteredNeighborhoods.sort((a, b) => {
  if (a.tier !== b.tier) return a.tier - b.tier;
  return a.name.localeCompare(b.name);
});

// Update the data
data.neighborhoods = filteredNeighborhoods;

// Write back
fs.writeFileSync(NEIGHBORHOODS_FILE, JSON.stringify(data, null, 2));

console.log(`\n✓ Consolidated from ${41} to ${filteredNeighborhoods.length} neighborhoods`);
console.log(`  Tier 1: ${filteredNeighborhoods.filter(n => n.tier === 1).length}`);
console.log(`  Tier 2: ${filteredNeighborhoods.filter(n => n.tier === 2).length}`);
