import digest from '../data/digest-latest.json';
import pinnedStories from '../data/pinned-stories.json';
import fs from 'node:fs';
import path from 'node:path';

export interface StorySource {
  name: string;
  url: string;
}

export interface Story {
  id: string;
  headline: string;
  summary: string;
  body: string;
  neighborhood: string;
  neighborhoods: string[];
  source: string;
  sourceUrl: string;
  sources?: StorySource[];
  imageUrl: string | null;
  imageAlt: string;
  publishedAt: string;
  keywords: string[];
}

export interface Section {
  category: string;
  stories: Story[];
}

export interface Digest {
  date: string;
  generatedAt: string;
  summary: string;
  topStory: Story;
  sections: Section[];
  neighborhoods: Record<string, { storyCount: number; topStory: string }>;
}

export function getDigest(): Digest {
  const d = digest as Digest;

  // Merge pinned stories into the Development & Housing section
  if (pinnedStories.length > 0) {
    const pinnedIds = new Set(pinnedStories.map((s: any) => s.id));
    const alreadyPresent = d.sections.some((sec) =>
      sec.stories.some((s) => pinnedIds.has(s.id))
    );

    if (!alreadyPresent) {
      let devSection = d.sections.find((s) => s.category === 'Development & Housing');
      if (!devSection) {
        devSection = { category: 'Development & Housing', stories: [] };
        d.sections.unshift(devSection);
      }
      devSection.stories.push(...(pinnedStories as unknown as Story[]));
    }
  }

  return d;
}

// Content filter: drop violent crime stories from all outputs
const CRIME_PATTERNS = [
  /\bmurder(?:ed|s|ing)?\b/i,
  /\bhomicide\b/i,
  /\bkill(?:ed|ing|s)\b/i,
  /\bstabb(?:ed|ing)\b/i,
  /\brape[ds]?\b/i,
  /\bsexual\s+assault/i,
  /\bchild\s+abuse\b/i,
  /\bfatal\s+shoot/i,
  /\bshot\s+(?:and\s+)?kill/i,
  /\bman\s+(?:found\s+)?dead\b/i,
  /\bwoman\s+(?:found\s+)?dead\b/i,
  /\bchild\s+(?:found\s+)?dead\b/i,
  /\bbody\s+found\b/i,
  /\bdead\s+(?:at|in|on|near)\b/i,
  /\bgun\s+violence\b/i,
  /\bshooting\b/i,
];

function isCrimeStory(story: Story): boolean {
  const text = `${story.headline} ${story.summary} ${(story.keywords || []).join(' ')}`;
  return CRIME_PATTERNS.some((p) => p.test(text));
}

export function getAllStories(): Story[] {
  const d = getDigest();
  return d.sections.flatMap((s) => s.stories).filter((s) => !isCrimeStory(s));
}

// Get ALL stories from ALL archived digests (for building permanent story pages)
export function getAllArchivedStories(): Story[] {
  const storyMap = new Map<string, Story>();

  // Add pinned stories first
  for (const story of pinnedStories as unknown as Story[]) {
    storyMap.set(story.id, story);
  }

  // Read all archived digests
  const archiveDates = getArchiveDates();
  for (const date of archiveDates) {
    const digest = getDigestByDate(date);
    if (digest) {
      // Include topStory
      if (digest.topStory && !storyMap.has(digest.topStory.id)) {
        storyMap.set(digest.topStory.id, digest.topStory);
      }
      for (const section of digest.sections) {
        for (const story of section.stories) {
          // Only add if not already present (keeps newest version)
          if (!storyMap.has(story.id)) {
            storyMap.set(story.id, story);
          }
        }
      }
    }
  }

  // Also include current digest
  const current = getDigest();
  // Include topStory from current digest
  if (current.topStory && !storyMap.has(current.topStory.id)) {
    storyMap.set(current.topStory.id, current.topStory);
  }
  for (const section of current.sections) {
    for (const story of section.stories) {
      if (!storyMap.has(story.id)) {
        storyMap.set(story.id, story);
      }
    }
  }

  return Array.from(storyMap.values()).filter((s) => !isCrimeStory(s));
}

// Get a story by slug from ALL archives (not just today)
export function getArchivedStoryBySlug(slug: string): Story | undefined {
  return getAllArchivedStories().find((s) => s.id === slug);
}

export function getStoryBySlug(slug: string): Story | undefined {
  return getAllStories().find((s) => s.id === slug);
}

export function getStoriesByNeighborhood(neighborhood: string): Story[] {
  // Use ALL archived stories for cumulative neighborhood pages
  return getAllArchivedStories().filter(
    (s) => s.neighborhoods.includes(neighborhood) || s.neighborhood === neighborhood
  );
}

export function getAllNeighborhoods(): string[] {
  // Get all unique neighborhoods from ALL archived stories
  const allStories = getAllArchivedStories();
  const neighborhoodSet = new Set<string>();
  for (const story of allStories) {
    if (story.neighborhood) neighborhoodSet.add(story.neighborhood);
    if (story.neighborhoods) {
      for (const n of story.neighborhoods) neighborhoodSet.add(n);
    }
  }
  return Array.from(neighborhoodSet).sort();
}

export function getNeighborhoodData(): Record<string, { storyCount: number; topStory: string }> {
  // Compute neighborhood data from ALL archived stories (cumulative counts)
  const allStories = getAllArchivedStories();
  const data: Record<string, { storyCount: number; topStory: string }> = {};

  for (const story of allStories) {
    const neighborhoods = new Set<string>();
    if (story.neighborhood) neighborhoods.add(story.neighborhood);
    if (story.neighborhoods) {
      for (const n of story.neighborhoods) neighborhoods.add(n);
    }

    for (const name of neighborhoods) {
      if (!data[name]) {
        data[name] = { storyCount: 0, topStory: story.id };
      }
      data[name].storyCount++;
    }
  }
  return data;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function timeAgo(isoStr: string): string {
  const now = new Date();
  const then = new Date(isoStr);
  const diffMs = now.getTime() - then.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const NEIGHBORHOOD_COLORS: Record<string, string> = {
  Midtown: '#2d6a9f',
  Buckhead: '#5b7a3a',
  Downtown: '#7a5b3a',
  'East Atlanta': '#9f2d6a',
  'East Atlanta Village': '#9f2d6a',
  'Grant Park': '#3a7a5b',
  'Inman Park': '#6a2d9f',
  'Virginia-Highland': '#3a5b7a',
  'Old Fourth Ward': '#c8553d',
  Decatur: '#5b3a7a',
  Kirkwood: '#7a3a5b',
  'Little Five Points': '#d4762c',
  Edgewood: '#5a7a3a',
  Reynoldstown: '#3a7a7a',
  Cabbagetown: '#7a7a3a',
  Summerhill: '#2d9f6a',
  Peoplestown: '#3a9f7a',
  'West End': '#9f6a2d',
  Westside: '#6a9f2d',
  'Poncey-Highland': '#2d6a9f',
  'Candler Park': '#4a8a5a',
  Morningside: '#5a6a8a',
  'Druid Hills': '#6a8a5a',
  'Ansley Park': '#8a5a6a',
  'West Midtown': '#5a8a7a',
  'Castleberry Hill': '#8a7a5a',
  'Sweet Auburn': '#7a5a8a',
  'Atlantic Station': '#4a7a8a',
  'Home Park': '#8a6a4a',
  'Piedmont Heights': '#6a7a4a',
};

export function getNeighborhoodColor(neighborhood: string): string {
  return NEIGHBORHOOD_COLORS[neighborhood] || '#6b7280';
}

// Archive functions

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

export function getArchiveDates(): string[] {
  const files = fs.readdirSync(DATA_DIR);
  return files
    .filter((f: string) => /^digest-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f: string) => f.replace('digest-', '').replace('.json', ''))
    .sort()
    .reverse();
}

export function getDigestByDate(date: string): Digest | null {
  const filePath = path.join(DATA_DIR, `digest-${date}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as Digest;
}

export function getAdjacentDates(date: string): { prev: string | null; next: string | null } {
  const dates = getArchiveDates();
  const idx = dates.indexOf(date);
  return {
    prev: idx >= 0 && idx < dates.length - 1 ? dates[idx + 1] : null,
    next: idx > 0 ? dates[idx - 1] : null,
  };
}

export const SITE_URL = 'https://atlantanewsandtalk.com';
export const SITE_NAME = 'Atlanta News & Talk';
export const SITE_DESCRIPTION = 'Daily hyperlocal news from Inside The Perimeter Atlanta neighborhoods';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
