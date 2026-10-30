'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { File, FileText, Info, Loader2, Search, Star, X, AlertCircle } from 'lucide-react';
import { getFavoriteTemplates, searchTemplates } from '@/lib/actions/templates';

const SEARCH_DEBOUNCE_MS = 300;

export const BLANK_TEMPLATE = 'blank';

const PREVIEW_WIDTH = 320;
const PREVIEW_MARGIN = 16;

/**
 * Enlarged thumbnail shown next to the hovered one. Rendered in a portal with
 * fixed positioning so the scrollable list and the modal do not clip it.
 */
function ThumbnailPreview({ src, alt, anchor, ratio }) {
  const width = Math.min(PREVIEW_WIDTH, window.innerWidth - 2 * PREVIEW_MARGIN);
  const height = Math.min(width * ratio, window.innerHeight - 2 * PREVIEW_MARGIN);

  // Right of the thumbnail when there is room, left otherwise.
  const fitsRight = anchor.right + PREVIEW_MARGIN + width <= window.innerWidth - PREVIEW_MARGIN;
  const left = fitsRight
    ? anchor.right + PREVIEW_MARGIN
    : Math.max(PREVIEW_MARGIN, anchor.left - PREVIEW_MARGIN - width);

  const top = Math.min(
    Math.max(PREVIEW_MARGIN, anchor.top + anchor.height / 2 - height / 2),
    window.innerHeight - PREVIEW_MARGIN - height,
  );

  return createPortal(
    <div
      className="fixed z-[120] pointer-events-none rounded-lg overflow-hidden bg-white border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      style={{ left, top, width, height }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="w-full h-full object-contain" />
    </div>,
    document.body,
  );
}

/**
 * Thumbnail of a template (from its typst.toml), with a placeholder while it
 * loads, an enlarged preview on hover, and a fallback icon if there is none.
 */
function TemplateThumbnail({ template }) {
  const [failed, setFailed] = useState(false);
  const [ratio, setRatio] = useState(null);
  const [anchor, setAnchor] = useState(null);

  const loaded = ratio !== null;

  useEffect(() => {
    if (!anchor) return;

    // The preview would stay in place while the list scrolls under it.
    const close = () => setAnchor(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);

    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [anchor]);

  if (!template.hasThumbnail || failed) {
    return (
      <div className="w-16 h-20 shrink-0 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center">
        <FileText className="text-slate-400" size={24} />
      </div>
    );
  }

  const src = `/api/templates/${encodeURIComponent(template.name)}/thumbnail?v=${encodeURIComponent(template.version)}`;
  const alt = `${template.name} preview`;

  const handleImageLoaded = (img) => {
    if (img?.complete && img.naturalWidth > 0) {
      setRatio(img.naturalHeight / img.naturalWidth);
    }
  };

  return (
    <div
      className={`relative w-16 h-20 shrink-0 rounded-md overflow-hidden bg-white border border-slate-200 ${
        loaded ? 'cursor-zoom-in' : ''
      }`}
      onMouseEnter={(e) => loaded && setAnchor(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setAnchor(null)}
    >
      {!loaded && (
        <div className="absolute inset-0 bg-slate-100 animate-pulse flex items-center justify-center">
          <FileText className="text-slate-300" size={24} />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        // Already cached images can finish loading before onLoad is attached.
        ref={handleImageLoaded}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={(e) => handleImageLoaded(e.currentTarget)}
        onError={() => setFailed(true)}
        className={`w-full h-full object-cover object-top transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {anchor && <ThumbnailPreview src={src} alt={alt} anchor={anchor} ratio={ratio} />}
    </div>
  );
}

/**
 * Selectable row of a Typst Universe template.
 */
function TemplateOption({ template, selected, disabled, onSelect }) {
  return (
    <label
      data-test={template.name}
      className={`group flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50/50 ring-4 ring-blue-50'
          : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input
        type="radio"
        name="template-choice"
        value={template.name}
        className="hidden"
        disabled={disabled}
        checked={selected}
        onChange={() => onSelect(template.name)}
      />

      <TemplateThumbnail template={template} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-slate-800 truncate">{template.name}</span>
          <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-xs font-mono">
            v{template.version}
          </span>
        </div>
        {template.description && (
          <p className="mt-1 text-xs text-slate-500 line-clamp-2">{template.description}</p>
        )}
        {template.authors.length > 0 && (
          <p className="mt-1 text-xs text-slate-400 truncate">{template.authors.join(', ')}</p>
        )}
      </div>

      <a
        href={template.universeUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title="View on Typst Universe"
        aria-label={`View ${template.name} on Typst Universe`}
        className="shrink-0 p-1.5 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
      >
        <Info size={18} />
      </a>
    </label>
  );
}

/**
 * Template chooser: blank project, favorite (ISC-HEI) templates by default,
 * or a search across every Typst Universe template.
 */
export default function TemplatePicker({ selectedTemplate, onSelect, disabled }) {
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [results, setResults] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const requestId = useRef(0);

  const trimmedQuery = query.trim();

  useEffect(() => {
    let cancelled = false;

    getFavoriteTemplates()
      .then((result) => {
        if (cancelled) return;
        if (result.error) setFavoritesError(result.error);
        else setFavorites(result.templates);
      })
      .catch(() => !cancelled && setFavoritesError('Unable to load templates.'))
      .finally(() => !cancelled && setFavoritesLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!trimmedQuery) return;

    const id = requestId.current;

    const timeout = setTimeout(async () => {
      try {
        const result = await searchTemplates(trimmedQuery);
        if (id !== requestId.current) return;

        if (result.error) {
          setSearchError(result.error);
          setResults([]);
        } else {
          setSearchError(null);
          setResults(result.templates);
        }
      } catch {
        if (id === requestId.current) setSearchError('Unable to search templates.');
      } finally {
        if (id === requestId.current) setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [trimmedQuery]);

  const handleQueryChange = (value) => {
    setQuery(value);

    if (value.trim() === trimmedQuery) return;

    // Ignore the answers of searches made for a previous query.
    requestId.current++;

    if (value.trim()) {
      setSearchLoading(true);
    } else {
      setResults([]);
      setSearchError(null);
      setSearchLoading(false);
    }
  };

  const templates = trimmedQuery ? results : favorites;
  const isLoading = trimmedQuery ? searchLoading : favoritesLoading;
  const error = trimmedQuery ? searchError : favoritesError;

  return (
    <div className="space-y-3 mb-8">
      <label className="text-sm font-bold text-slate-700 ml-1">Template</label>

      <label
        data-test="Blank Project"
        className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
          selectedTemplate === BLANK_TEMPLATE
            ? 'border-blue-500 bg-blue-50/50 ring-4 ring-blue-50'
            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          type="radio"
          name="template-choice"
          value={BLANK_TEMPLATE}
          className="hidden"
          disabled={disabled}
          checked={selectedTemplate === BLANK_TEMPLATE}
          onChange={() => onSelect(BLANK_TEMPLATE)}
        />
        <File className="text-gray-400" size={24} />
        <div>
          <span className="block font-bold text-sm text-slate-800">Blank Project</span>
          <span className="block text-xs text-slate-500">Empty document</span>
        </div>
      </label>

      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          disabled={disabled}
          maxLength={100}
          data-test="template-search-input"
          placeholder="Search a template on Typst Universe"
          className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
        />
        {query && (
          <button
            type="button"
            onClick={() => handleQueryChange('')}
            disabled={disabled}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {selectedTemplate !== BLANK_TEMPLATE &&
        !templates.some((t) => t.name === selectedTemplate) && (
          <p className="text-xs text-slate-500 ml-1">
            Selected: <span className="font-semibold text-slate-700">{selectedTemplate}</span>
          </p>
        )}

      <div className="flex items-center justify-between ml-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {trimmedQuery ? (
            <>
              <Search size={12} /> Results from Typst Universe
            </>
          ) : (
            <>
              <Star size={12} /> Favorites
            </>
          )}
        </span>
        {isLoading && <Loader2 size={14} className="text-slate-400 animate-spin" />}
      </div>

      <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!error && !isLoading && templates.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">
            {trimmedQuery ? `No template found for "${trimmedQuery}".` : 'No favorite template.'}
          </p>
        )}

        {templates.map((template) => (
          <TemplateOption
            key={template.name}
            template={template}
            selected={selectedTemplate === template.name}
            disabled={disabled}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
