import {
  ArrowDownToLine,
  Bold,
  Italic,
  Underline,
  Folders,
  Languages,
  Settings2,
  Lock,
  Check,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEditorWatcher } from '@/hooks/useEditor';
import { useEffect, useRef, useState } from 'react';
import { functions, refs, initPreviewRefs, applyLanguageToTypst } from '@/hooks/refs';
import { SidePanel } from './SidePanel';

const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

const DEFAULT_LANG = 'en';
const LANG_STORAGE_KEY = 'typst-language';

function loadInitialLang() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return LANGUAGES.some((l) => l.code === saved) ? saved : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function Toolbar({
  fontSize,
  onFontSizeChange,
  wordWrap,
  onWordWrapChange,
  canEdit = true,
  panelHost,
}) {
  const btnSaveRef = useRef(null);
  const btnBRef = useRef(null);
  const btnIRef = useRef(null);
  const btnURef = useRef(null);
  const btnLangRef = useRef(null);
  const btnShowImagesRef = useRef(null);
  const btnSettingsRef = useRef(null);

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
  const [activeLang, setActiveLang] = useState(loadInitialLang);
  const [isApplyingLang, setIsApplyingLang] = useState(false);

  useEditorWatcher();

  const currentLang = LANGUAGES.find((l) => l.code === activeLang) ?? LANGUAGES[0];

  const closeFileExplorer = () => {
    setIsFileExplorerOpen(false);

    if (refs.imageExplorer) {
      refs.imageExplorer.style.display = 'none';
    }
  };

  const openFileExplorer = () => {
    setIsFileExplorerOpen(true);
    setIsLangOpen(false);
    setIsSettingsOpen(false);

    if (refs.imageExplorer) {
      refs.imageExplorer.style.display = 'block';
    }
  };

  const openLanguage = () => {
    setIsLangOpen(true);
    setIsSettingsOpen(false);
    setIsFileExplorerOpen(false);

    if (refs.imageExplorer) {
      refs.imageExplorer.style.display = 'none';
    }
  };

  const openSettings = () => {
    setIsSettingsOpen(true);
    setIsLangOpen(false);
    setIsFileExplorerOpen(false);

    if (refs.imageExplorer) {
      refs.imageExplorer.style.display = 'none';
    }
  };

  const closeAllPanels = () => {
    setIsLangOpen(false);
    setIsSettingsOpen(false);
    setIsFileExplorerOpen(false);

    if (refs.imageExplorer) {
      refs.imageExplorer.style.display = 'none';
    }
  };

  const handleSelectLanguage = (code) => {
    if (code === activeLang) {
      setIsLangOpen(false);
      return;
    }

    setIsApplyingLang(true);
    try {
      applyLanguageToTypst(code);
      setActiveLang(code);
      try {
        localStorage.setItem(LANG_STORAGE_KEY, code);
      } catch {}
      setIsLangOpen(false);
    } catch (err) {
      console.error('Impossible de changer la langue :', err);
    } finally {
      setIsApplyingLang(false);
    }
  };

  useEffect(() => {
    initPreviewRefs({
      btnSave: btnSaveRef.current,
      btnBold: btnBRef.current,
      btnItalic: btnIRef.current,
      btnUnderline: btnURef.current,
      btnLang: btnLangRef.current,
      btnShowImages: btnShowImagesRef.current,
    });

    functions.openLanguageMenu = openLanguage;
    functions.openFileExplorer = openFileExplorer;
    functions.closeFileExplorer = closeFileExplorer;

    return () => {
      functions.openLanguageMenu = null;
      functions.openFileExplorer = null;
      functions.closeFileExplorer = null;
    };
  }, []);

  const disabledClass = 'opacity-30 cursor-not-allowed pointer-events-none';

  return (
    <>
      <nav className="w-14 border-r border-slate-200 flex flex-col items-center py-4 gap-4 shrink-0 bg-slate-50/50">
        {!canEdit && (
          <div title="Readonly mode" className="p-2 rounded-lg bg-amber-50 text-amber-500">
            <Lock size={16} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            ref={btnSaveRef}
            disabled={!canEdit}
            className={`p-2.5 rounded-xl hover:bg-white hover:shadow-sm hover:text-blue-600 transition-all text-slate-500 ${
              !canEdit ? disabledClass : ''
            }`}
            title={canEdit ? 'Save' : 'Readonly mode'}
          >
            <ArrowDownToLine size={20} />
          </button>
        </div>

        <div className="w-8 h-[1px] bg-slate-200" />

        <div className="flex flex-col gap-2">
          <button
            ref={btnBRef}
            disabled={!canEdit}
            className={`p-2.5 rounded-xl hover:bg-white hover:shadow-sm text-slate-500 ${
              !canEdit ? disabledClass : ''
            }`}
            title={canEdit ? 'Bold' : 'Readonly mode'}
          >
            <Bold size={18} />
          </button>

          <button
            ref={btnIRef}
            disabled={!canEdit}
            className={`p-2.5 rounded-xl hover:bg-white hover:shadow-sm text-slate-500 ${
              !canEdit ? disabledClass : ''
            }`}
            title={canEdit ? 'Italic' : 'Readonly mode'}
          >
            <Italic size={18} />
          </button>

          <button
            ref={btnURef}
            disabled={!canEdit}
            className={`p-2.5 rounded-xl hover:bg-white hover:shadow-sm text-slate-500 ${
              !canEdit ? disabledClass : ''
            }`}
            title={canEdit ? 'Underline' : 'Readonly mode'}
          >
            <Underline size={18} />
          </button>
        </div>

        <div className="w-8 h-[1px] bg-slate-200" />

        <button
          ref={btnShowImagesRef}
          onClick={() => {
            if (isFileExplorerOpen) {
              closeFileExplorer();
            } else {
              openFileExplorer();
            }
          }}
          className={`p-2.5 rounded-xl transition-all ${
            isFileExplorerOpen
              ? 'bg-blue-50 text-blue-600 shadow-inner'
              : 'hover:bg-white hover:shadow-sm hover:text-blue-600 text-slate-500'
          }`}
          title="Files Explorer"
        >
          <Folders size={20} />
        </button>

        <div className="w-8 h-[1px] bg-slate-200" />

        <button
          ref={btnSettingsRef}
          onClick={() => {
            if (isSettingsOpen) {
              closeAllPanels();
            } else {
              openSettings();
            }
          }}
          className={`p-2.5 rounded-xl transition-all ${
            isSettingsOpen
              ? 'bg-blue-50 text-blue-600 shadow-inner'
              : 'hover:bg-white hover:shadow-sm text-slate-500'
          }`}
          title="Editor Settings"
        >
          <Settings2 size={18} />
        </button>

        <button
          ref={btnLangRef}
          disabled={!canEdit}
          onClick={() => {
            if (isLangOpen) {
              closeAllPanels();
            } else {
              openLanguage();
            }
          }}
          className={`relative p-2.5 rounded-xl transition-all ${
            isLangOpen
              ? 'bg-blue-50 text-blue-600 shadow-inner'
              : 'hover:bg-white hover:shadow-sm text-slate-500'
          } ${!canEdit ? disabledClass : ''}`}
          title={canEdit ? `Language : ${currentLang.label}` : 'Readonly mode'}
        >
          <Languages size={18} />

          <span className="absolute -bottom-1 -right-1 min-w-[18px] px-1 h-4 flex items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-bold uppercase leading-none shadow-sm">
            {currentLang.code}
          </span>
        </button>
      </nav>

      {panelHost &&
        isLangOpen &&
        canEdit &&
        createPortal(
          <SidePanel title="Language" icon={Languages} onClose={() => setIsLangOpen(false)}>
            <div className="flex flex-col gap-2" role="listbox" aria-label="Langue du document">
              {LANGUAGES.map(({ code, label, flag }) => {
                const isActive = code === activeLang;

                return (
                  <button
                    key={code}
                    role="option"
                    aria-selected={isActive}
                    disabled={isApplyingLang}
                    onClick={() => handleSelectLanguage(code)}
                    className={`flex justify-between items-center text-left p-3 rounded-xl transition-colors border ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-inner'
                        : 'border-transparent hover:bg-blue-50 hover:text-blue-600'
                    } ${isApplyingLang ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-lg leading-none">{flag}</span>
                      <span className={isActive ? 'font-semibold' : 'font-medium'}>{label}</span>
                    </span>

                    {isActive && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                        <Check size={14} />
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </SidePanel>,
          panelHost
        )}

      {panelHost &&
        isSettingsOpen &&
        createPortal(
          <SidePanel
            title="Editor Settings"
            icon={Settings2}
            onClose={() => setIsSettingsOpen(false)}
          >
            <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Text Size
              </p>

              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                {fontSize}px
              </span>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <span className="text-[11px] text-slate-400 font-medium">A</span>

              <input
                type="range"
                min={10}
                max={28}
                step={1}
                value={fontSize}
                onChange={(e) => onFontSizeChange?.(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none bg-slate-200 accent-blue-600 cursor-pointer"
              />

              <span className="text-lg text-slate-400 font-medium">A</span>
            </div>

            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">
              Line Wrapping
            </p>

            <button
              onClick={() => onWordWrapChange?.(!wordWrap)}
              className="flex justify-between items-center w-full p-3 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <span className="font-medium text-sm text-slate-700">Line Wrapping</span>

              <span
                role="switch"
                aria-checked={wordWrap}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                  wordWrap ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    wordWrap ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </span>
            </button>
          </SidePanel>,
          panelHost
        )}
    </>
  );
}
