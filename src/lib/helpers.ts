import digest from '../data/digest-latest.json';

export interface Story {
  id: string;
  headline: string;
  summary: string;
  body: string;
  neighborhood: string;
  neighborhoods: string[];
  source: string;
  sourceUrl: string;
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
  return digest as Digest;
}

export function getAllStories(): Story[] {
  const d = getDigest();
  return d.sections.flatMap((s) => s.stories);
}

export function getStoryBySlug(slug: string): Story | undefined {
  return getAllStories().find((s) => s.id === slug);
}

export function getStoriesByNeighborhood(neighborhood: string): Story[] {
  return getAllStories().filter(
    (s) => s.neighborhoods.includes(neighborhood) || s.neighborhood === neighborhood
  );
}

export function getAllNeighborhoods(): string[] {
  const d = getDigest();
  return Object.keys(d.neighborhoods).sort();
}

export function getNeighborhoodData(): Record<string, { storyCount: number; topStory: string }> {
  return getDigest().neighborhoods;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
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

export const SITE_URL = 'https://atlantanewsandtalk.com';
export const SITE_NAME = 'Atlanta News & Talk';
export const SITE_DESCRIPTION = 'Daily hyperlocal news from Inside The Perimeter Atlanta neighborhoods';
