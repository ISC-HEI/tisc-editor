'use client';

import { useEffect, useState } from 'react';
import { X, Plus, Tag, Loader2 } from 'lucide-react';
import { addTagToProject, getProjectTags, removeTagFromProject } from '@/lib/actions/tags';

export default function EditProjectTagsModal({ projectId, onClose }) {
  const [projectTags, setProjectTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTags = async () => {
      try {
        setIsLoading(true);

        const data = await getProjectTags(projectId);

        setProjectTags(data.projectTags);
        setAvailableTags(data.availableTags);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load tags.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTags();
  }, [projectId]);

  const addTag = async (tagValue = tagInput) => {
    const tag = tagValue.trim().toLowerCase();

    if (!tag || isPending) {
      return;
    }

    if (projectTags.some((t) => t.name === tag)) {
      setTagInput('');
      return;
    }

    if (projectTags.length >= 10) {
      setError('Maximum 10 tags allowed.');
      return;
    }

    try {
      setIsPending(true);
      setError('');

      const result = await addTagToProject(projectId, tag);

      setProjectTags((prev) => [...prev, result.tag]);

      setTagInput('');

      setAvailableTags((prev) => {
        if (prev.some((t) => t.id === result.tag.id)) {
          return prev;
        }

        return [...prev, result.tag];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add tag.');
    } finally {
      setIsPending(false);
    }
  };

  const removeTag = async (tag) => {
    if (isPending) {
      return;
    }

    try {
      setIsPending(true);
      setError('');

      await removeTagFromProject(projectId, tag.name);

      setProjectTags((prev) => prev.filter((t) => t.id !== tag.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove tag.');
    } finally {
      setIsPending(false);
    }
  };

  const filteredTags = availableTags.filter((tag) => {
    if (projectTags.some((t) => t.id === tag.id)) {
      return false;
    }

    const search = tagInput.trim().toLowerCase();

    if (!search) {
      return true;
    }

    return tag.name.includes(search);
  });

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Tag size={18} className="text-blue-600" />
            </div>

            <div>
              <h2 className="font-bold text-slate-900">Project Tags</h2>

              <p className="text-xs text-slate-500">Add or remove tags</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* Current tags */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-slate-700">Current tags</label>

                  <span className="text-xs text-slate-400">{projectTags.length}/10</span>
                </div>

                {projectTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {projectTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                      >
                        #{tag.name}
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => removeTag(tag)}
                          className="hover:text-blue-900 hover:bg-blue-200 rounded-full p-0.5 transition-colors disabled:opacity-50"
                          aria-label={`Remove ${tag.name}`}
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No tags yet.</p>
                )}
              </div>

              {/* Add tag */}
              <div>
                <label className="text-sm font-bold text-slate-700">Add tag</label>

                <div className="relative mt-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      disabled={isPending || projectTags.length >= 10}
                      maxLength={50}
                      placeholder="Search or create a tag..."
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
                    />

                    <button
                      type="button"
                      onClick={() => addTag()}
                      disabled={isPending || !tagInput.trim() || projectTags.length >= 10}
                      className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
                    >
                      {isPending ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Plus size={18} />
                      )}
                    </button>
                  </div>

                  {/* Suggestions */}
                  {!isPending && tagInput.trim() && filteredTags.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      {filteredTags.slice(0, 8).map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => addTag(tag.name)}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors text-sm text-slate-700"
                        >
                          #{tag.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="mt-4 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="w-full px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-100 disabled:opacity-50 text-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
