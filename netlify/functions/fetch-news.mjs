import Anthropic from '@anthropic-ai/sdk';
import RSSParser from 'rss-parser';
// Digest returned in response. Save locally or use build plugin to write to repo.

const parser = new RSSParser({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: false }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});

const SOURCES = [
  { name: 'Decaturish', url: 'https://decaturish.com/feed/', tier: 1 },
  { name: 'Urbanize Atlanta', url: 'https://atlanta.urbanize.city/feed', tier: 1 },
  { name: 'Atlanta Civic Circle', url: 'https://atlantaciviccircle.org/feed/', tier: 1 },
  { name: 'SaportaReport', url: 'https://saportareport.com/feed/', tier: 2 },
  { name: 'Rough Draft Atlanta', url: 'https://roughdraftatlanta.com/feed/', tier: 2 },
  { name: 'The Atlanta Voice', url: 'https://www.theatlantavoice.com/feed/', tier: 2 },
  { name: 'Georgia Recorder', url: 'https://georgiarecorder.com/feed/', tier: 2 },
  { name: 'Global Atlanta', url: 'https://globalatlanta.com/feed/', tier: 2 },
  { name: '11Alive', url: 'https://www.11alive.com/feeds/syndication/rss/news', tier: 3 },
  { name: 'WSB-TV', url: 'https://www.wsbtv.com/arc/outboundfeeds/rss/?outputType=xml', tier: 3 },
  { name: 'GPB News', url: 'https://www.gpb.org/news/rss.xml', tier: 3 },
];

const ITP_NEIGHBORHOODS = [
  'Old Fourth Ward', 'Grant Park', 'Reynoldstown', 'Cabbagetown', 'Inman Park',
  'Summerhill', 'East Atlanta Village', 'Ormewood Park', 'Kirkwood', 'Edgewood',
  'Little Five Points', 'Candler Park', 'Poncey-Highland', 'Decatur', 'East Atlanta',
  'Peoplestown', 'Chosewood Park', 'Sweet Auburn', 'Midtown', 'Downtown',
  'Virginia-Highland', 'Morningside', 'Druid Hills', 'Ansley Park', 'Piedmont Heights',
  'West Midtown', 'Westside', 'West End', 'Buckhead', 'Castleberry Hill',
  'Home Park', 'Atlantic Station', 'Collier Hills', 'Bolton', 'Grove Park',
  'Capitol View', 'Adair Park', 'Oakland City', 'Mechanicsville',
  'Lakewood Heights', 'Sylvan Hills', 'Pittsburgh',
];

function extractImageFromItem(item) {
  if (item.mediaContent?.$?.url) return item.mediaContent.$.url;
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;
  if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) return item.enclosure.url;
  if (item.contentEncoded) {
    const match = item.contentEncoded.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match?.[1]) return match[1];
  }
  if (item.content) {
    const match = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match?.[1]) return match[1];
  }
  return null;
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchFeed(source) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AtlantaNewsAndTalk/1.0' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const xml = await res.text();
    const feed = await parser.parseString(xml);
    const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;

    return feed.items
      .filter((item) => {
        const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : 0;
        return pubDate > twoDaysAgo;
      })
      .slice(0, 15)
      .map((item) => {
        let textContent = '';
        if (item.contentEncoded) textContent = stripHtml(item.contentEncoded).slice(0, 1500);
        else if (item.contentSnippet) textContent = item.contentSnippet.slice(0, 1500);
        else if (item.content) textContent = stripHtml(item.content).slice(0, 1500);

        return {
          title: item.title || '',
          link: item.link || '',
          pubDate: item.pubDate || '',
          content: textContent,
          source: source.name,
          tier: source.tier,
          imageUrl: extractImageFromItem(item),
        };
      });
  } catch (err) {
    console.error(`Failed ${source.name}: ${err.message}`);
    return [];
  }
}

async function summarize(articles) {
  const client = new Anthropic();
  const today = new Date().toISOString().slice(0, 10);

  const articleText = articles
    .map((a, i) =>
      `${i + 1}. [${a.source}] "${a.title}"\n   ${a.content.slice(0, 800)}\n   Link: ${a.link}\n   Image: ${a.imageUrl || 'none'}\n   Published: ${a.pubDate}`
    )
    .join('\n\n');

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `You are a local Atlanta blogger who lives ITP and knows every neighborhood. You write like you're telling your friend about the news over coffee. Warm, conversational, occasionally opinionated, always well-informed.

Your special focus is the SE BeltLine corridor: Old Fourth Ward, Grant Park, Reynoldstown, Cabbagetown, Inman Park, Summerhill, East Atlanta Village, Ormewood Park.

Given these articles, produce a JSON digest. PRIORITIZE SE BeltLine stories.

Output this exact JSON structure:
{
  "date": "${today}",
  "generatedAt": "${new Date().toISOString()}",
  "summary": "2-3 sentence casual overview of the day. Mention specific neighborhoods.",
  "topStory": { the single most significant story object, prefer SE BeltLine },
  "sections": [
    {
      "category": "Category Name",
      "stories": [
        {
          "id": "url-friendly-slug",
          "headline": "Short punchy headline, 8-12 words",
          "summary": "3-4 sentences. Sound like a knowledgeable neighbor, not a press release.",
          "body": "2-3 paragraph write-up with personality and real details. Include <a href> outbound links to relevant official sites, Wikipedia pages, or source URLs when referencing specific people, places, or organizations. Use <blockquote> for key takeaways or practical info. No corporate-speak.",
          "neighborhood": "Most specific ITP neighborhood",
          "neighborhoods": ["Primary", "Others"],
          "source": "Source name",
          "sourceUrl": "original URL",
          "imageUrl": "image URL or null",
          "imageAlt": "descriptive alt text",
          "publishedAt": "ISO date",
          "keywords": ["local", "search", "terms"]
        }
      ]
    }
  ],
  "neighborhoods": { "Name": { "storyCount": N, "topStory": "slug" } }
}

RULES:
- Neighborhoods from: ${ITP_NEIGHBORHOODS.join(', ')}
- Categories: Development & Housing, Transit & Infrastructure, Food & Drink, Arts & Culture, Politics & Policy, Public Safety, Community, Business
- Only ITP-relevant stories
- SE BeltLine gets priority
- Write like a real person. Have a voice.
- Headlines: active, present tense, conversational
- Body: 2-3 substantial paragraphs with outbound links in <a> tags
- NEVER use em dashes (use periods, commas, parentheses)
- NEVER use "vibrant", "bustling", "nestled", "tapestry", "delves"
- NEVER mention "AI" or automation
- 8-15 stories total
- topStory also appears in its section
- Preserve image URLs from source data

Articles:
${articleText}

Respond with ONLY valid JSON.`,
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return JSON.parse(text);
}

export default async function handler(req) {
  try {
    console.log('Fetching from', SOURCES.length, 'sources...');
    const results = await Promise.all(SOURCES.map(fetchFeed));
    const articles = results.flat();

    if (articles.length === 0) {
      return new Response(JSON.stringify({ message: 'No articles found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const withImages = articles.filter((a) => a.imageUrl).length;
    console.log(`${articles.length} articles (${withImages} with images)`);

    const digest = await summarize(articles);

    console.log('Digest generated successfully');

    const storyCount = digest.sections.reduce((n, s) => n + s.stories.length, 0);
    console.log(`Digest: ${storyCount} stories, ${Object.keys(digest.neighborhoods).length} neighborhoods`);

    return new Response(JSON.stringify({
      success: true,
      articleCount: articles.length,
      storyCount,
      digest,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Failed:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  schedule: '@daily',
};
