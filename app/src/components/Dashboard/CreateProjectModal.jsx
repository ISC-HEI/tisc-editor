"use client";

import { useState } from "react";
import { Plus, X, LayoutTemplate, FileText, GraduationCap, BookOpen, ClipboardList, Loader2 } from "lucide-react";
import { createProject } from "@/app/dashboard/actions";

const execSummaryVersion = "0.6.0"
const bthesisVersion = "0.6.0"
const reportVersion = "0.6.0"
const TEMPLATES = [
    {
        id: "blank",
        name: "Blank Project",
        description: "Empty document",
        icon: <FileText className="text-gray-400" size={32} />
    },
    {
        id: `isc-hei-exec-summary/${execSummaryVersion}/src`,
        name: "ISC-HEI Exec Summary",
        description: "Executive summary for the bachelor thesis",
        templateFile: "exec_summary.typ",
        icon: <GraduationCap className="text-blue-500" size={32} />
    },
    {
        id: `isc-hei-bthesis/${bthesisVersion}/src`,
        name: "ISC-HEI BThesis",
        description: "Official bachelor thesis document",
        templateFile: "bachelor_thesis.typ",
        icon: <BookOpen className="text-purple-500" size={32} />
    },
    {
        id: `isc-hei-report/${reportVersion}/src`,
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

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
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
                        onClick={() => !isCreating && setIsOpen(false)}
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
                                    onClick={() => setIsOpen(false)}
                                    className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            )}
                        </div>

                        <form
                            action={async (formData) => {
                                setIsCreating(true);
                                try {
                                    await createProject(formData);
                                    setIsOpen(false);
                                } finally {
                                    setIsCreating(false);
                                }
                            }}
                            className="p-6"
                        >
                            <input
                                type="hidden"
                                name="entryFile"
                                value={TEMPLATES.find(t => t.id === selectedTemplate)?.templateFile || ""}
                            />

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                {TEMPLATES.map((t) => (
                                    <label
                                        key={t.id}
                                        className={`group relative cursor-pointer p-4 border-2 rounded-xl flex flex-col items-center text-center transition-all ${selectedTemplate === t.id
                                                ? "border-blue-500 bg-blue-50/50 ring-4 ring-blue-50"
                                                : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                                            } ${isCreating ? "opacity-50 cursor-not-allowed" : ""}`}
                                    >
                                        <input
                                            type="radio"
                                            name="template"
                                            value={t.id}
                                            className="hidden"
                                            disabled={isCreating}
                                            onChange={() => setSelectedTemplate(t.id)}
                                            checked={selectedTemplate === t.id}
                                        />
                                        <div className="mb-3 transform group-hover:scale-110 transition-transform">
                                            {t.icon}
                                        </div>
                                        <span className="font-bold text-sm text-slate-800">{t.name}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="space-y-2 mb-8">
                                <label className="text-sm font-bold text-slate-700 ml-1">Project Name</label>
                                <input
                                    name="title"
                                    type="text"
                                    disabled={isCreating}
                                    placeholder="Ex: Final internship report"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    required
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    disabled={isCreating}
                                    onClick={() => setIsOpen(false)}
                                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg disabled:bg-blue-400 transition-all"
                                >
                                    Confirm and Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}