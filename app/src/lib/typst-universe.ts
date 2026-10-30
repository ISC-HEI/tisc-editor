import sharp from 'sharp';
import { FileNode, ProjectFileTree } from '@/types/filetree';
import { mapLimit } from '@/lib/storage';

const INDEX_URL = 'https://packages.typst.org/preview/index.json';
const INDEX_TTL_MS = 60 * 60 * 1000;
const PACKAGES_REPO = 'typst/packages';
const PACKAGES_BRANCH = 'main';

export const FAVORITE_PREFIX = 'isc-hei-';
export const MAX_SEARCH_RESULTS = 10;

const MAX_TEMPLATE_FILES = 300;
const MAX_TEMPLATE_SIZE = 30 * 1024 * 1024;
const MAX_THUMBNAIL_SIZE = 10 * 1024 * 1024;
const THUMBNAIL_WIDTH = 480;
const THUMBNAIL_CACHE_SIZE = 200;
const DOWNLOAD_CONCURRENCY = 8;

const NAME_RE = /^[a-z0-9_][a-z0-9_-]*$/i;
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const SEGMENT_RE = /^[\p{L}\p{N}_][\p{L}\p{N}\p{M}_.\- ]*$/u;

/**
 * A package entry of the Typst Universe index (mirrors its typst.toml).
 */
type IndexEntry = {
  name: string;
  version: string;
  description?: string;
  keywords?: string[];
  categories?: string[];
  authors?: string[];
  updatedAt?: number;
  template?: {
    path: string;
    entrypoint: string;
    thumbnail?: string;
  };
};

export type UniverseTemplate = {
  name: string;
  version: string;
  description: string;
  keywords: string[];
  authors: string[];
  updatedAt: number;
  path: string;
  entrypoint: string;
  thumbnail: string | null;
};

/**
 * What the client receives for a template (no internal paths).
 */
export type TemplateSummary = {
  name: string;
  version: string;
  description: string;
  authors: string[];
  hasThumbnail: boolean;
  universeUrl: string;
};

let indexCache: { templates: Map<string, UniverseTemplate>; fetchedAt: number } | null = null;
let indexPromise: Promise<Map<string, UniverseTemplate>> | null = null;

const thumbnailCache = new Map<string, Buffer>();

/**
 * Builds the fetch options for GitHub, with or without the auth token.
 */
function getGitHubFetchOptions(useAuth = true): RequestInit {
  const headers: Record<string, string> = {
    'User-Agent': 'TISC-Editor-App',
  };

  if (useAuth && process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  // Responses can exceed the 2MB limit of the Next.js data cache.
  return { headers, cache: 'no-store' };
}

/**
 * Makes a request to GitHub using the token when available, and retries without
 * the token if the authenticated request fails (401, or 404 on raw.githubusercontent.com).
 */
async function fetchGitHub(url: string) {
  const authResponse = await fetch(url, getGitHubFetchOptions(true));
  if (
    process.env.GITHUB_TOKEN &&
    (authResponse.status === 401 ||
      (authResponse.status === 404 && url.includes('raw.githubusercontent.com')))
  ) {
    console.warn(`GitHub token invalid or blocked, retrying without auth for ${url}`);
    return await fetch(url, getGitHubFetchOptions(false));
  }
  return authResponse;
}

/**
 * Compares two semver strings (x.y.z), returning a positive number if a > b.
 */
function compareVersions(a: string, b: string) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/**
 * Normalizes a relative path from a typst.toml ("./template/" -> "template"),
 * returning null if it is unsafe (absolute, "..", odd characters).
 */
function normalizeRelativePath(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;

  const parts = value
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part !== '' && part !== '.');

  if (value.startsWith('/') || parts.some((part) => part === '..' || !SEGMENT_RE.test(part))) {
    return null;
  }

  return parts.join('/');
}

/**
 * Turns a raw index entry into a template, or null if it is not a valid template.
 */
function toTemplate(entry: IndexEntry): UniverseTemplate | null {
  if (!entry?.template || !NAME_RE.test(entry.name) || !VERSION_RE.test(entry.version)) {
    return null;
  }

  const path = normalizeRelativePath(entry.template.path);
  const entrypoint = normalizeRelativePath(entry.template.entrypoint);
  const thumbnail = entry.template.thumbnail
    ? normalizeRelativePath(entry.template.thumbnail)
    : null;

  if (path === null || !entrypoint) {
    return null;
  }

  return {
    name: entry.name,
    version: entry.version,
    description: entry.description ?? '',
    keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
    authors: Array.isArray(entry.authors)
      ? entry.authors.map((author) => author.replace(/\s*<[^>]*>\s*/g, '').trim())
      : [],
    updatedAt: entry.updatedAt ?? 0,
    path,
    entrypoint,
    thumbnail: thumbnail || null,
  };
}

/**
 * Downloads the Typst Universe index and keeps the latest version of every
 * package that provides a template.
 */
async function loadIndex(): Promise<Map<string, UniverseTemplate>> {
  const response = await fetch(INDEX_URL, {
    headers: { 'User-Agent': 'TISC-Editor-App' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Unable to load Typst Universe: ${response.status} ${response.statusText}`);
  }

  const entries = (await response.json()) as IndexEntry[];

  if (!Array.isArray(entries)) {
    throw new Error('Invalid Typst Universe index.');
  }

  // Keep the latest version of each package, then only those offering a template.
  const latest = new Map<string, IndexEntry>();
  for (const entry of entries) {
    if (!entry || !NAME_RE.test(entry.name) || !VERSION_RE.test(entry.version)) continue;

    const current = latest.get(entry.name);
    if (!current || compareVersions(entry.version, current.version) > 0) {
      latest.set(entry.name, entry);
    }
  }

  const templates = new Map<string, UniverseTemplate>();
  for (const entry of latest.values()) {
    const template = toTemplate(entry);
    if (template) templates.set(template.name, template);
  }

  return templates;
}

/**
 * Returns the cached templates index, refreshing it once it is older than an hour.
 * A stale index is still served if the refresh fails.
 */
async function getTemplates(): Promise<Map<string, UniverseTemplate>> {
  if (indexCache && Date.now() - indexCache.fetchedAt < INDEX_TTL_MS) {
    return indexCache.templates;
  }

  if (!indexPromise) {
    indexPromise = loadIndex()
      .then((templates) => {
        indexCache = { templates, fetchedAt: Date.now() };
        return templates;
      })
      .finally(() => {
        indexPromise = null;
      });
  }

  try {
    return await indexPromise;
  } catch (error) {
    if (indexCache) {
      console.error('Typst Universe refresh failed, serving stale index:', error);
      return indexCache.templates;
    }
    throw error;
  }
}

/**
 * Converts a template into what the client needs to display it.
 */
export function toSummary(template: UniverseTemplate): TemplateSummary {
  return {
    name: template.name,
    version: template.version,
    description: template.description,
    authors: template.authors,
    hasThumbnail: !!template.thumbnail,
    universeUrl: `https://typst.app/universe/package/${template.name}`,
  };
}

/**
 * Returns the latest version of a template, or null if the package is unknown
 * or does not provide a template.
 */
export async function findTemplate(name: string): Promise<UniverseTemplate | null> {
  if (!NAME_RE.test(name)) return null;
  const templates = await getTemplates();
  return templates.get(name) ?? null;
}

/**
 * Returns the favorite templates (the official ISC-HEI ones).
 */
export async function listFavoriteTemplates(): Promise<UniverseTemplate[]> {
  const templates = await getTemplates();

  return [...templates.values()]
    .filter((template) => template.name.startsWith(FAVORITE_PREFIX))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Searches templates by name, keywords and description. Every word of the query
 * must match; results matching on the name come first.
 */
export async function searchUniverseTemplates(
  query: string,
  limit = MAX_SEARCH_RESULTS,
): Promise<UniverseTemplate[]> {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 10);

  if (words.length === 0) return [];

  const fullQuery = words.join('-');
  const templates = await getTemplates();
  const results: { template: UniverseTemplate; score: number }[] = [];

  for (const template of templates.values()) {
    const name = template.name.toLowerCase();
    const keywords = template.keywords.map((keyword) => keyword.toLowerCase());
    const description = template.description.toLowerCase();

    let score = 0;
    let matchesAll = true;

    for (const word of words) {
      if (name.includes(word)) score += name.startsWith(word) ? 6 : 4;
      else if (keywords.some((keyword) => keyword.includes(word))) score += 2;
      else if (description.includes(word)) score += 1;
      else {
        matchesAll = false;
        break;
      }
    }

    if (!matchesAll) continue;
    if (name === fullQuery) score += 100;

    results.push({ template, score });
  }

  return results
    .sort((a, b) => b.score - a.score || b.template.updatedAt - a.template.updatedAt)
    .slice(0, limit)
    .map((result) => result.template);
}

/**
 * Builds the raw.githubusercontent.com URL of a file inside a package version.
 */
function rawPackageUrl(template: UniverseTemplate, filePath: string) {
  const segments = [template.name, template.version, ...filePath.split('/')]
    .map(encodeURIComponent)
    .join('/');
  return `https://raw.githubusercontent.com/${PACKAGES_REPO}/${PACKAGES_BRANCH}/packages/preview/${segments}`;
}

/**
 * Returns a resized WebP thumbnail of a template (as declared in its typst.toml),
 * or null if it has none.
 */
export async function getTemplateThumbnail(name: string): Promise<Buffer | null> {
  const template = await findTemplate(name);
  if (!template?.thumbnail) return null;

  const cacheKey = `${template.name}@${template.version}`;
  const cached = thumbnailCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetchGitHub(rawPackageUrl(template, template.thumbnail));
  if (!response.ok) return null;

  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_THUMBNAIL_SIZE) return null;

  const original = Buffer.from(await response.arrayBuffer());
  if (original.byteLength > MAX_THUMBNAIL_SIZE) return null;

  const resized = await sharp(original)
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  if (thumbnailCache.size >= THUMBNAIL_CACHE_SIZE) {
    const oldestKey = thumbnailCache.keys().next().value;
    if (oldestKey) thumbnailCache.delete(oldestKey);
  }
  thumbnailCache.set(cacheKey, resized);

  return resized;
}

/**
 * Inserts a file into a tree, creating intermediate folders as needed.
 */
function insertFile(root: Record<string, FileNode>, filePath: string, node: FileNode) {
  const parts = filePath.split('/');
  let current = root;

  for (const part of parts.slice(0, -1)) {
    if (!current[part]) {
      current[part] = { type: 'folder', name: part, children: {} };
    }
    current = current[part].children!;
  }

  current[parts[parts.length - 1]] = node;
}

/**
 * Downloads the template folder of a Typst Universe package (the [template]
 * section of its typst.toml) and builds the project's file tree. The entrypoint
 * becomes the main file (renamed to main.typ when it sits at the template root).
 */
export async function importTemplateAsTree(
  template: UniverseTemplate,
): Promise<{ fileTree: ProjectFileTree }> {
  const treePath = ['packages/preview', template.name, template.version, template.path]
    .filter(Boolean)
    .join('/');

  // A single API call lists the whole folder; contents come from raw.githubusercontent.com.
  const treeUrl = `https://api.github.com/repos/${PACKAGES_REPO}/git/trees/${PACKAGES_BRANCH}:${treePath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}?recursive=1`;

  try {
    const response = await fetchGitHub(treeUrl);

    if (!response.ok) {
      if (response.status === 403 || response.status === 429) {
        throw new Error('GitHub API rate limit exceeded.');
      }
      throw new Error(`GitHub API error ${response.status} ${response.statusText}`);
    }

    const tree = (await response.json()) as {
      truncated?: boolean;
      tree?: { path: string; type: string; size?: number }[];
    };

    if (!Array.isArray(tree.tree) || tree.truncated) {
      throw new Error('Unable to list the template files.');
    }

    const blobs = tree.tree.filter((item) => {
      if (item.type !== 'blob') return false;
      const parts = item.path.split('/');
      const fileName = parts[parts.length - 1];
      return (
        normalizeRelativePath(item.path) === item.path &&
        !parts.some((part) => part.startsWith('.')) &&
        !(fileName.endsWith('.md') && item.path !== template.entrypoint) &&
        fileName !== 'LICENSE'
      );
    });

    if (!blobs.some((item) => item.path === template.entrypoint)) {
      throw new Error(`Entrypoint "${template.entrypoint}" not found in the template.`);
    }

    if (blobs.length > MAX_TEMPLATE_FILES) {
      throw new Error(`Template has too many files (${blobs.length}).`);
    }

    const totalSize = blobs.reduce((sum, item) => sum + (item.size ?? 0), 0);
    if (totalSize > MAX_TEMPLATE_SIZE) {
      throw new Error('Template is too large.');
    }

    const isRootEntrypoint = !template.entrypoint.includes('/');
    const renameToMain =
      isRootEntrypoint &&
      (template.entrypoint === 'main.typ' || !blobs.some((item) => item.path === 'main.typ'));

    const children: Record<string, FileNode> = {};

    await mapLimit(blobs, DOWNLOAD_CONCURRENCY, async (item) => {
      const fileUrl = rawPackageUrl(template, [template.path, item.path].filter(Boolean).join('/'));
      const fileResponse = await fetchGitHub(fileUrl);

      if (!fileResponse.ok) {
        throw new Error(
          `Unable to download "${item.path}": ${fileResponse.status} ${fileResponse.statusText}`,
        );
      }

      if (item.path === template.entrypoint) {
        const mainPath = renameToMain ? 'main.typ' : item.path;
        const parts = mainPath.split('/');

        insertFile(children, mainPath, {
          type: 'file',
          name: parts[parts.length - 1],
          fullPath: mainPath,
          isMain: true,
          data: (await fileResponse.text()).replace(/\0/g, ''),
        });
        return;
      }

      const parts = item.path.split('/');
      const base64 = Buffer.from(await fileResponse.arrayBuffer()).toString('base64');

      insertFile(children, item.path, {
        type: 'file',
        name: parts[parts.length - 1],
        fullPath: item.path,
        data: `data:application/octet-stream;base64,${base64}`,
      });
    });

    return {
      fileTree: {
        type: 'folder',
        name: 'root',
        children,
      },
    };
  } catch (error) {
    console.error('Template import error:', error);

    throw new Error(
      `Template import failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
