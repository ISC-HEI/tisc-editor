'use server';

import {
  listFavoriteTemplates,
  searchUniverseTemplates,
  toSummary,
  TemplateSummary,
} from '@/lib/typst-universe';
import { requireUserId } from './utils';

const MAX_QUERY_LENGTH = 100;

/**
 * Returns the favorite templates (official ISC-HEI templates from Typst Universe).
 */
export async function getFavoriteTemplates(): Promise<
  { templates: TemplateSummary[] } | { error: string }
> {
  await requireUserId();

  try {
    const templates = await listFavoriteTemplates();
    return { templates: templates.map(toSummary) };
  } catch (error) {
    console.error('Failed to load favorite templates:', error);
    return { error: 'Unable to load templates from Typst Universe.' };
  }
}

/**
 * Searches Typst Universe templates (max 10 results).
 */
export async function searchTemplates(
  query: string,
): Promise<{ templates: TemplateSummary[] } | { error: string }> {
  await requireUserId();

  if (typeof query !== 'string') {
    return { templates: [] };
  }

  try {
    const templates = await searchUniverseTemplates(query.slice(0, MAX_QUERY_LENGTH));
    return { templates: templates.map(toSummary) };
  } catch (error) {
    console.error('Template search failed:', error);
    return { error: 'Unable to search Typst Universe.' };
  }
}
