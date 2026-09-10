"use client";

import { useState } from "react";
import { Plus, X, LayoutTemplate, FileText, GraduationCap, BookOpen, ClipboardList, Loader2, AlertCircle } from "lucide-react";
import { createProject, getTagsByUser } from "@/app/dashboard/actions";

const TEMPLATES = [
    {
        id: "blank",
        packageBase: "blank",
        name: "Blank Project",
        description: "Empty document",
        icon: <FileText className="text-gray-400" size={32} />
    },
    {
        id: "isc-hei-exec-summary",
        packageBase: "isc-hei-exec-summary",
        packageSubPath: "src",
        name: "ISC-HEI Exec Summary",
        description: "Executive summary for the bachelor thesis",
        templateFile: "exec_summary.typ",
        icon: <GraduationCap className="text-blue-500" size={32} />
    },
    {
        id: "isc-hei-bthesis",
        packageBase: "isc-hei-bthesis",
        packageSubPath: "src",
        name: "ISC-HEI BThesis",
        description: "Official bachelor thesis document",
        templateFile: "bachelor_thesis.typ",
        icon: <BookOpen className="text-purple-500" size={32} />
    },
    {
        id: "isc-hei-report",
        packageBase: "isc-hei-report",
        packageSubPath: "src",
        name: "ISC-HEI Report",
        description: "Official template for project report",
        templateFile: "report.typ",
        icon: <ClipboardList className="text-emerald-500" size={32} />
    }
];

export default function CreateProjectModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState("blank");
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState(null);

    // Tags
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState("");
    const [availableTags, setAvailableTags] = useState([]);

    const openModal = async () => {
        setIsOpen(true);
        setError(null);

        try {
            const existingTags = await getTagsByUser();
            setAvailableTags(existingTags);
        } catch (err) {
            console.error("Failed to load tags:", err);
        }
    };

    const addTag = (tagValue = tagInput) => {
        const tag = tagValue.trim().toLowerCase();

        if (!tag) {
            return;
        }

        if (tags.includes(tag)) {
            setTagInput("");
            return;
        }

        if (tags.length >= 10) {
            return;
        }

        setTags([...tags, tag]);
        setTagInput("");
    };

    const removeTag = (tagToRemove) => {
        setTags(tags.filter((tag) => tag !== tagToRemove));
    };

    const filteredTags = availableTags.filter((tag) => {
        const search = tagInput.trim().toLowerCase();

        if (tags.includes(tag.name)) {
            return false;
        }

        if (!search) {
            return true;
        }

        return tag.name.includes(search);
    });

    const closeModal = () => {
        if (isCreating) {
            return;
        }

        setIsOpen(false);
        setError(null);
        setTags([]);
        setTagInput("");
        setSelectedTemplate("blank");
    };

    return (
        <>
            <button
                onClick={openModal}
                data-test="create-project-button"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg active:scale-95"
            >
                <Plus size={20} /> New Project
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {isCreating && (
                        <div className="absolute inset-0 z-[110] bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center cursor-wait animate-in fade-in duration-200">
                            <Loader2 className="text-blue-600 animate-spin mb-4" size={48} />
                            <p className="text-slate-900 font-bold text-lg">Creating your project...</p>
                            <p className="text-slate-500 text-sm">Downloading templates from GitHub</p>
                        </div>
                    )}

                    <div
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        onClick={closeModal}
                    />

                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <LayoutTemplate className="text-blue-600" size={24} />
                                    Create Project
                                </h2>
                            </div>
                            {!isCreating && (
                                <button
                                    onClick={closeModal}
                                    className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            )}
                        </div>
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();

                                if (isCreating) {
                                    return;
                                }

                                setIsCreating(true);
                                setError(null);

                                const formData = new FormData(e.currentTarget);

                                /*
                                 * Ajouter tous les tags au FormData.
                                 */
                                tags.forEach((tag) => {
                                    formData.append("tags", tag);
                                });

                                try {
                                    await createProject(formData);

                                    setIsOpen(false);
                                    setTags([]);
                                    setTagInput("");
                                    setSelectedTemplate("blank");
                                } catch (err) {
                                    setError(
                                        err instanceof Error
                                            ? err.message
                                            : "An error occurred."
                                    );
                                } finally {
                                    setIsCreating(false);
                                }
                            }}
                            className="p-6"
                        >
                            <input
                                type="hidden"
                                name="entryFile"
                                value={
                                    TEMPLATES.find(
                                        (t) => t.id === selectedTemplate
                                    )?.templateFile || ""
                                }
                            />

                            <input
                                type="hidden"
                                name="packageBase"
                                value={
                                    TEMPLATES.find(
                                        (t) => t.id === selectedTemplate
                                    )?.packageBase || "blank"
                                }
                            />

                            <input
                                type="hidden"
                                name="packageSubPath"
                                value={
                                    TEMPLATES.find(
                                        (t) => t.id === selectedTemplate
                                    )?.packageSubPath || ""
                                }
                            />

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                {TEMPLATES.map((t) => (
                                    <label
                                        key={t.id}
                                        className={`group relative cursor-pointer p-4 border-2 rounded-xl flex flex-col items-center text-center transition-all ${
                                            selectedTemplate === t.id
                                                ? "border-blue-500 bg-blue-50/50 ring-4 ring-blue-50"
                                                : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                                        } ${
                                            isCreating
                                                ? "opacity-50 cursor-not-allowed"
                                                : ""
                                        }`}
                                        data-test={t.name}
                                    >
                                        <input
                                            type="radio"
                                            name="template"
                                            value={t.id}
                                            className="hidden"
                                            disabled={isCreating}
                                            onChange={() =>
                                                setSelectedTemplate(t.id)
                                            }
                                            checked={
                                                selectedTemplate === t.id
                                            }
                                        />

                                        <div className="mb-3 transform group-hover:scale-110 transition-transform">
                                            {t.icon}
                                        </div>

                                        <span className="font-bold text-sm text-slate-800">
                                            {t.name}
                                        </span>
                                    </label>
                                ))}
                            </div>

                            {/* Project name */}
                            <div className="space-y-2 mb-6">
                                <label className="text-sm font-bold text-slate-700 ml-1">
                                    Project Name
                                </label>

                                <input
                                    name="title"
                                    type="text"
                                    data-test="project-name-input"
                                    disabled={isCreating}
                                    placeholder="Ex: Final internship report"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    required
                                />
                            </div>

                            {/* Tags */}
                            <div className="space-y-2 mb-8">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-slate-700 ml-1">
                                        Tags
                                    </label>

                                    <span className="text-xs text-slate-400">
                                        {tags.length}/10
                                    </span>
                                </div>

                                {/* Tag input + suggestions */}
                                <div className="relative">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={tagInput}
                                            onChange={(e) =>
                                                setTagInput(e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    addTag();
                                                }
                                            }}
                                            disabled={
                                                isCreating ||
                                                tags.length >= 10
                                            }
                                            placeholder="Ex: thesis"
                                            maxLength={50}
                                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
                                        />

                                        <button
                                            type="button"
                                            disabled={
                                                isCreating ||
                                                !tagInput.trim() ||
                                                tags.length >= 10
                                            }
                                            onClick={() => addTag()}
                                            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold disabled:opacity-50 transition-colors"
                                        >
                                            Add
                                        </button>
                                    </div>

                                    {/* Suggestions */}
                                    {!isCreating &&
                                        tagInput.trim() &&
                                        filteredTags.length > 0 && (
                                            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                                                {filteredTags
                                                    .slice(0, 8)
                                                    .map((tag) => (
                                                        <button
                                                            key={tag.id}
                                                            type="button"
                                                            onClick={() =>
                                                                addTag(tag.name)
                                                            }
                                                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors text-sm text-slate-700"
                                                        >
                                                            <span className="font-medium">
                                                                #{tag.name}
                                                            </span>
                                                        </button>
                                                    ))}
                                            </div>
                                        )}
                                </div>

                                {/* Tags list */}
                                {tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                                            >
                                                #{tag}

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeTag(tag)
                                                    }
                                                    disabled={isCreating}
                                                    className="hover:text-blue-900 hover:bg-blue-200 rounded-full p-0.5 transition-colors disabled:opacity-50"
                                                    aria-label={`Remove ${tag}`}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {tags.length === 0 && (
                                    <p className="text-xs text-slate-400 ml-1">
                                        Add tags to organize your projects.
                                    </p>
                                )}
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <AlertCircle
                                        size={18}
                                        className="text-red-500 shrink-0 mt-0.5"
                                    />

                                    <p className="text-sm text-red-700 font-medium">
                                        {error}
                                    </p>
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    disabled={isCreating}
                                    onClick={closeModal}
                                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg disabled:bg-blue-400 transition-all"
                                >
                                    {isCreating
                                        ? "Creating..."
                                        : "Confirm and Create"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}