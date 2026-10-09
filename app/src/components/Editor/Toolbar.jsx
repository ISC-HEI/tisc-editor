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
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEditorWatcher } from '@/hooks/useEditor';
import { forwardRef, useEffect, useState } from 'react';
import { functions, refs, initPreviewRefs, applyLanguageToTypst } from '@/hooks/refs';
import { SidePanel } from './SidePanel';

const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

const DEFAULT_LANG = 'en';
const LANG_STORAGE_KEY = 'typst-language';
const EXPANDED_STORAGE_KEY = 'toolbar-expanded';

function loadInitialLang() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return LANGUAGES.some((l) => l.code === saved) ? saved : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

function loadInitialExpanded() {
  try {
    const saved = localStorage.getItem(EXPANDED_STORAGE_KEY);
    return saved === null ? true : saved === 'true';
  } catch {
    return true;
  }
}

const disabledClass = 'opacity-30 cursor-not-allowed pointer-events-none';

/**
 * A toolbar button that shows only the icon when collapsed,
 * and icon + label (+ optional trailing content) when expanded.
 */
const ToolbarButton = forwardRef(function ToolbarButton(
  {
    icon: Icon,
    iconSize = 18,
    label,
    expanded,
    active = false,
    disabled = false,
    disabledTitle,
    onClick,
    hoverText = 'hover:text-blue-600',
    badge,
    trailing,
    pressed,
  },
  ref,
) {
  const title = disabled && disabledTitle ? disabledTitle : expanded ? undefined : label;

  return (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      aria-pressed={pressed}
      className={`relative flex items-center rounded-xl transition-all ${
        expanded ? 'w-full gap-3 p-2.5' : 'justify-center p-3'
      } ${
        active
          ? 'bg-blue-50 text-blue-600 shadow-inner'
          : `text-slate-500 hover:bg-white hover:shadow-sm ${hoverText}`
      } ${disabled ? disabledClass : ''}`}
    >
      <span className="relative inline-flex shrink-0">
        <Icon size={iconSize} />

        {badge && (
          <span className="absolute -bottom-2 -right-3 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold uppercase leading-none text-white shadow-sm ring-2 ring-slate-50">
            {badge}
          </span>
        )}
      </span>

      {expanded && (
        <span className="flex-1 truncate whitespace-nowrap text-left text-sm font-medium">
          {label}
        </span>
      )}

      {expanded && trailing}
    </button>
  );
});

export function Toolbar({
  fontSize,
  onFontSizeChange,
  wordWrap,
  onWordWrapChange,
  canEdit = true,
  panelHost,
}) {
  // Refs handed to the preview/editor logic (initPreviewRefs)
  const [btnSaveEl, setBtnSaveEl] = useState(null);
  const [btnBEl, setBtnBEl] = useState(null);
  const [btnIEl, setBtnIEl] = useState(null);
  const [btnUEl, setBtnUEl] = useState(null);
  const [btnLangEl, setBtnLangEl] = useState(null);
  const [btnShowImagesEl, setBtnShowImagesEl] = useState(null);

  const [isExpanded, setIsExpanded] = useState(loadInitialExpanded);
  // Single source of truth for the open side panel: null | 'lang' | 'settings' | 'files'
  const [activePanel, setActivePanel] = useState(null);
  const [activeLang, setActiveLang] = useState(loadInitialLang);
  const [isApplyingLang, setIsApplyingLang] = useState(false);

  useEditorWatcher();

  const currentLang = LANGUAGES.find((l) => l.code === activeLang) ?? LANGUAGES[0];

  const showImageExplorer = (visible) => {
    if (refs.imageExplorer) {
      refs.imageExplorer.style.display = visible ? 'block' : 'none';
    }
  };

  const openPanel = (name) => {
    setActivePanel(name);
    showImageExplorer(name === 'files');
  };

  const closePanel = () => {
    setActivePanel(null);
    showImageExplorer(false);
  };

  const togglePanel = (name) => {
    if (activePanel === name) closePanel();
    else openPanel(name);
  };

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(EXPANDED_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  };

  const handleSelectLanguage = (code) => {
    if (code === activeLang) {
      closePanel();
      return;
    }

    setIsApplyingLang(true);
    try {
      applyLanguageToTypst(code);
      setActiveLang(code);
      try {
        localStorage.setItem(LANG_STORAGE_KEY, code);
      } catch {}
      closePanel();
    } catch (err) {
      console.error('Unable to change the language:', err);
    } finally {
      setIsApplyingLang(false);
    }
  };

  // Expose the DOM buttons to the preview logic once they are mounted
  useEffect(() => {
    initPreviewRefs({
      btnSave: btnSaveEl,
      btnBold: btnBEl,
      btnItalic: btnIEl,
      btnUnderline: btnUEl,
      btnLang: btnLangEl,
      btnShowImages: btnShowImagesEl,
    });
  }, [btnSaveEl, btnBEl, btnIEl, btnUEl, btnLangEl, btnShowImagesEl]);

  // Expose panel actions to the rest of the app (setters are stable, no stale closures)
  useEffect(() => {
    functions.openLanguageMenu = () => openPanel('lang');
    functions.openFileExplorer = () => openPanel('files');
    functions.closeFileExplorer = () => closePanel();

    return () => {
      functions.openLanguageMenu = null;
      functions.openFileExplorer = null;
      functions.closeFileExplorer = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape closes the open panel
  useEffect(() => {
    if (!activePanel) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel]);

  const Divider = () => (
    <div className={`h-px shrink-0 bg-slate-200 ${isExpanded ? 'w-full' : 'w-10'}`} />
  );

  const readonlyTitle = 'Readonly mode';

  return (
    <>
      <nav
        aria-label="Editor toolbar"
        className={`flex shrink-0 flex-col gap-3 overflow-hidden border-r border-slate-200 bg-slate-50/50 py-4 transition-[width] duration-200 ${
          isExpanded ? 'w-52 items-stretch px-2' : 'w-[72px] items-center'
        }`}
      >
        {/* Collapse / expand */}
        <ToolbarButton
          icon={isExpanded ? PanelLeftClose : PanelLeftOpen}
          iconSize={20}
          label={isExpanded ? 'Collapse toolbar' : 'Expand toolbar'}
          expanded={isExpanded}
          onClick={toggleExpanded}
        />

        {!canEdit && (
          <div
            title={readonlyTitle}
            className={`flex items-center gap-3 rounded-lg bg-amber-50 p-2 text-amber-500 ${
              isExpanded ? 'w-full' : 'justify-center'
            }`}
          >
            <Lock size={16} className="shrink-0" />
            {isExpanded && (
              <span className="truncate whitespace-nowrap text-xs font-medium">Readonly mode</span>
            )}
          </div>
        )}

        <Divider />

        <div className="flex w-full flex-col gap-1">
          <ToolbarButton
            ref={setBtnSaveEl}
            icon={ArrowDownToLine}
            iconSize={20}
            label="Save"
            expanded={isExpanded}
            disabled={!canEdit}
            disabledTitle={readonlyTitle}
          />
        </div>

        <Divider />

        <div className="flex w-full flex-col gap-1">
          <ToolbarButton
            ref={setBtnBEl}
            icon={Bold}
            label="Bold"
            expanded={isExpanded}
            disabled={!canEdit}
            disabledTitle={readonlyTitle}
            hoverText=""
          />
          <ToolbarButton
            ref={setBtnIEl}
            icon={Italic}
            label="Italic"
            expanded={isExpanded}
            disabled={!canEdit}
            disabledTitle={readonlyTitle}
            hoverText=""
          />
          <ToolbarButton
            ref={setBtnUEl}
            icon={Underline}
            label="Underline"
            expanded={isExpanded}
            disabled={!canEdit}
            disabledTitle={readonlyTitle}
            hoverText=""
          />
        </div>

        <Divider />

        <div className="flex w-full flex-col gap-1">
          <ToolbarButton
            ref={setBtnShowImagesEl}
            icon={Folders}
            iconSize={20}
            label="Files Explorer"
            expanded={isExpanded}
            active={activePanel === 'files'}
            pressed={activePanel === 'files'}
            onClick={() => togglePanel('files')}
          />
        </div>

        <Divider />

        <div className="flex w-full flex-col gap-1">
          <ToolbarButton
            icon={Settings2}
            label="Editor Settings"
            expanded={isExpanded}
            active={activePanel === 'settings'}
            pressed={activePanel === 'settings'}
            hoverText=""
            onClick={() => togglePanel('settings')}
          />

          <ToolbarButton
            ref={setBtnLangEl}
            icon={Languages}
            label={isExpanded ? 'Language' : `Language: ${currentLang.label}`}
            expanded={isExpanded}
            active={activePanel === 'lang'}
            pressed={activePanel === 'lang'}
            disabled={!canEdit}
            disabledTitle={readonlyTitle}
            hoverText=""
            badge={isExpanded ? undefined : currentLang.code}
            trailing={
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <span className="text-base leading-none">{currentLang.flag}</span>
                <span className="font-bold uppercase">{currentLang.code}</span>
              </span>
            }
            onClick={() => togglePanel('lang')}
          />
        </div>
      </nav>

      {panelHost &&
        activePanel === 'lang' &&
        canEdit &&
        createPortal(
          <SidePanel title="Language" icon={Languages} onClose={closePanel}>
            <div className="flex flex-col gap-2" role="listbox" aria-label="Document language">
              {LANGUAGES.map(({ code, label, flag }) => {
                const isActive = code === activeLang;

                return (
                  <button
                    key={code}
                    role="option"
                    aria-selected={isActive}
                    disabled={isApplyingLang}
                    onClick={() => handleSelectLanguage(code)}
                    className={`flex items-center justify-between rounded-xl border p-3 text-left transition-colors ${
                      isActive
                        ? 'border-blue-200 bg-blue-50 text-blue-600 shadow-inner'
                        : 'border-transparent hover:bg-blue-50 hover:text-blue-600'
                    } ${isApplyingLang ? 'cursor-wait opacity-60' : ''}`}
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
          panelHost,
        )}

      {panelHost &&
        activePanel === 'settings' &&
        createPortal(
          <SidePanel title="Editor Settings" icon={Settings2} onClose={closePanel}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Text Size
              </p>

              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                {fontSize}px
              </span>
            </div>

            <div className="mb-6 flex items-center gap-3">
              <span className="text-[11px] font-medium text-slate-400">A</span>

              <input
                type="range"
                min={10}
                max={28}
                step={1}
                value={fontSize}
                onChange={(e) => onFontSizeChange?.(Number(e.target.value))}
                aria-label="Text size"
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600"
              />

              <span className="text-lg font-medium text-slate-400">A</span>
            </div>

            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Line Wrapping
            </p>

            <button
              onClick={() => onWordWrapChange?.(!wordWrap)}
              className="flex w-full items-center justify-between rounded-xl p-3 transition-colors hover:bg-slate-50"
            >
              <span className="text-sm font-medium text-slate-700">Line Wrapping</span>

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
          panelHost,
        )}
    </>
  );
}
