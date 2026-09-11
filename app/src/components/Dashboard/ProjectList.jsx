'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ChevronDown, Tag as TagIcon, Archive } from 'lucide-react';
import { ProjectCard } from './ProjectCard';
import { getTagsByUser } from '@/app/dashboard/actions';

export function ProjectList({ initialProjects }) {
  const [search, setSearch] = useState('');
  const [showShared, setShowShared] = useState(true);

  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  const [showInactive, setShowInactive] = useState(false);

  const tagInputRef = useRef(null);
  const tagContainerRef = useRef(null);

  // Load existing tags once
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await getTagsByUser();
        setAvailableTags(tags);
      } catch (error) {
        console.error('Failed to load tags:', error);
      }
    };

    loadTags();
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tagContainerRef.current && !tagContainerRef.current.contains(event.target)) {
        setShowTagSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const addTag = (tag) => {
    const normalizedTag =
      typeof tag === 'string' ? tag.trim().toLowerCase() : tag.name.trim().toLowerCase();

    if (!normalizedTag) return;

    // Don't add the same tag twice
    if (selectedTags.some((selectedTag) => selectedTag.name === normalizedTag)) {
      setTagInput('');
      return;
    }

    const existingTag = availableTags.find((availableTag) => availableTag.name === normalizedTag);

    setSelectedTags((current) => [
      ...current,
      existingTag || {
        id: `search-${normalizedTag}`,
        name: normalizedTag,
      },
    ]);

    setTagInput('');
    setShowTagSuggestions(false);
  };

  const removeTag = (tagName) => {
    setSelectedTags((current) => current.filter((tag) => tag.name !== tagName));
  };

  const handleTagKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();

      const value = tagInput.trim();

      if (!value) return;

      // If there is an exact existing tag, select it
      const exactTag = availableTags.find((tag) => tag.name.toLowerCase() === value.toLowerCase());

      addTag(exactTag || value);
    }

    if (event.key === 'Backspace' && !tagInput && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1].name);
    }

    if (event.key === 'Escape') {
      setShowTagSuggestions(false);
    }
  };

  const filteredTagSuggestions = availableTags.filter((tag) => {
    const alreadySelected = selectedTags.some((selectedTag) => selectedTag.name === tag.name);

    if (alreadySelected) return false;

    if (!tagInput.trim()) return true;

    return tag.name.toLowerCase().includes(tagInput.trim().toLowerCase());
  });

  const filteredProjects = initialProjects.filter((project) => {
    const matchesName = project.title.toLowerCase().includes(search.toLowerCase());

    const matchesShared = !showShared ? project.isAuthor : true;

    // AND filtering:
    // project must contain EVERY selected tag
    const matchesTags = selectedTags.every((selectedTag) =>
      project.tags?.some((projectTag) => projectTag.name === selectedTag.name),
    );

    return matchesName && matchesShared && matchesTags;
  });

  const activeProjects = filteredProjects.filter((project) => project.isActive !== false);
  const inactiveProjects = filteredProjects.filter((project) => project.isActive === false);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Project search */}
          <input
            type="text"
            placeholder="Search a project..."
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Guest projects */}
          <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap text-sm font-medium text-gray-600">
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              checked={showShared}
              onChange={(e) => setShowShared(e.target.checked)}
            />
            Show guest project
          </label>
        </div>

        {/* Tag filter */}
        <div ref={tagContainerRef} className="relative">
          <div
            className={`
              min-h-[42px]
              w-full
              flex
              flex-wrap
              items-center
              gap-2
              px-3
              py-1.5
              border
              rounded-lg
              cursor-text
              transition
              ${
                showTagSuggestions
                  ? 'border-blue-500 ring-2 ring-blue-100'
                  : 'border-gray-200 hover:border-gray-300'
              }
            `}
            onClick={() => {
              tagInputRef.current?.focus();
              setShowTagSuggestions(true);
            }}
          >
            <TagIcon size={16} className="text-gray-400 shrink-0" />

            {/* Selected tags */}
            {selectedTags.map((tag) => (
              <span
                key={tag.name}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium"
              >
                #{tag.name}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeTag(tag.name);
                  }}
                  className="text-blue-400 hover:text-blue-700"
                  aria-label={`Remove ${tag.name}`}
                >
                  <X size={13} />
                </button>
              </span>
            ))}

            {/* Tag input */}
            <input
              ref={tagInputRef}
              type="text"
              value={tagInput}
              onChange={(event) => {
                setTagInput(event.target.value);
                setShowTagSuggestions(true);
              }}
              onFocus={() => setShowTagSuggestions(true)}
              onKeyDown={handleTagKeyDown}
              placeholder={selectedTags.length === 0 ? 'Filter by tags...' : 'Add another tag...'}
              className="flex-1 min-w-[140px] py-1 bg-transparent outline-none text-sm text-gray-700 placeholder:text-gray-400"
            />

            <ChevronDown
              size={16}
              className={`text-gray-400 shrink-0 transition-transform ${
                showTagSuggestions ? 'rotate-180' : ''
              }`}
            />
          </div>

          {/* Autocomplete */}
          {showTagSuggestions && (
            <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                {tagInput.trim() ? 'Matching tags' : 'Available tags'}
              </div>

              {filteredTagSuggestions.length > 0 ? (
                <div className="max-h-60 overflow-y-auto py-1">
                  {filteredTagSuggestions.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="w-full px-3 py-2.5 flex items-center gap-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition"
                    >
                      <span className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center text-gray-400">
                        <TagIcon size={14} />
                      </span>

                      <span className="font-medium">#{tag.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-4 text-sm text-gray-400">No matching tag.</div>
              )}

              {tagInput.trim() &&
                !availableTags.some(
                  (tag) => tag.name.toLowerCase() === tagInput.trim().toLowerCase(),
                ) && (
                  <button
                    type="button"
                    onClick={() => addTag(tagInput)}
                    className="w-full px-3 py-2.5 border-t border-gray-100 flex items-center gap-2 text-left text-sm text-blue-600 hover:bg-blue-50"
                  >
                    <span className="font-medium">Use #{tagInput.trim().toLowerCase()}</span>
                  </button>
                )}
            </div>
          )}
        </div>

        {/* Active filters / result count */}
        {(selectedTags.length > 0 || search) && (
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>
              {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}{' '}
              found
            </span>

            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear tags
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3" data-test="project-list">
        {activeProjects.length === 0 ? (
          <div className="text-center py-20 bg-white border-2 border-dashed border-gray-200 rounded-2xl">
            <p className="text-gray-400">No project found.</p>
          </div>
        ) : (
          activeProjects.map((project) => <ProjectCard key={project.id} project={project} />)
        )}
      </div>

      {inactiveProjects.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl transition"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Archive size={16} className="text-gray-400" />
              Inactive projects
              <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs font-semibold">
                {inactiveProjects.length}
              </span>
            </span>

            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform ${showInactive ? 'rotate-180' : ''}`}
            />
          </button>

          {showInactive && (
            <div className="grid grid-cols-1 gap-3 mt-3 opacity-70">
              {inactiveProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
