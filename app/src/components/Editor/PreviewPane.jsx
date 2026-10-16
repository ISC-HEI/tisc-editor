import { useEffect, useRef, useState } from 'react';
import { ZoomOut, ZoomIn, Download, MessageSquare, MessageSquarePlus } from 'lucide-react';
import { initPreviewRefs } from '@/hooks/refs';
import { useZoomWatcher } from '@/hooks/useZoom';
import {
  anchorFromClientPoint,
  canComment,
  setActiveThread,
  setPanelOpen,
  startDraft,
  useComments,
} from '@/hooks/useComments';
import { CommentsPanel } from './CommentsPanel';
import Footer from '../Footer';

function PreviewContextMenu({ menu, onClose }) {
  useEffect(() => {
    const close = () => onClose();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      role="menu"
      className="fixed z-[100] w-48 bg-white border border-slate-200 shadow-2xl rounded-lg overflow-hidden py-1 animate-in fade-in zoom-in duration-100"
      style={{ top: menu.y, left: menu.x }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          startDraft(menu.anchor);
          onClose();
        }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
      >
        <MessageSquarePlus size={14} />
        <span>Add comment</span>
      </button>
    </div>
  );
}

export const PreviewPane = () => {
  const btnInRef = useRef(null);
  const btnOutRef = useRef(null);
  const pageRef = useRef(null);
  const displayRef = useRef(null);
  const previewContainerRef = useRef(null);

  const btnExportZip = useRef(null);
  const btnExportPdfRef = useRef(null);
  const btnExportSvgRef = useRef(null);
  useZoomWatcher();

  const comments = useComments();
  const [menu, setMenu] = useState(null);
  const openCount = comments.threads.filter((t) => !t.resolved).length;

  useEffect(() => {
    if (
      btnInRef.current &&
      btnOutRef.current &&
      pageRef.current &&
      displayRef.current &&
      btnExportPdfRef.current &&
      btnExportSvgRef.current &&
      btnExportZip.current &&
      previewContainerRef.current
    ) {
      initPreviewRefs({
        page: pageRef.current,
        previewContainer: previewContainerRef.current,

        btnExportZip: btnExportZip.current,
        btnExportPdf: btnExportPdfRef.current,
        btnExportSvg: btnExportSvgRef.current,

        btnZoomIn: btnInRef.current,
        btnZoomOut: btnOutRef.current,
        zoomLevelDisplay: displayRef.current,
      });
    }
  }, []);

  const handleContextMenu = (e) => {
    if (!canComment(comments)) return;

    const anchor = anchorFromClientPoint(e.clientX, e.clientY);
    if (!anchor) return;

    e.preventDefault();
    const MENU_WIDTH = 192;
    setMenu({
      x: Math.min(e.clientX, window.innerWidth - MENU_WIDTH - 8),
      y: e.clientY,
      anchor,
    });
  };

  const handlePageClick = (e) => {
    const pin = e.target.closest?.('.tisc-comment-pin');
    if (!pin?.dataset.commentId) return;
    e.stopPropagation();
    setActiveThread(pin.dataset.commentId, { scroll: false });
  };

  return (
    <div className="flex-1 bg-slate-100 overflow-hidden flex flex-col relative">
      <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center bg-slate-100 rounded-lg p-1">
          <button
            ref={btnOutRef}
            className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-slate-600"
          >
            <ZoomOut size={16} />
          </button>

          <span
            ref={displayRef}
            className="text-[11px] font-bold px-3 min-w-[50px] text-center text-slate-500"
          >
            100%
          </span>

          <button
            ref={btnInRef}
            className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-slate-600"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPanelOpen(!comments.panelOpen)}
            title="Comments"
            className={`flex items-center gap-2 text-[12px] font-semibold py-1.5 px-3 border rounded-lg ${
              comments.panelOpen
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <MessageSquare size={14} />
            {openCount > 0 && <span>{openCount}</span>}
          </button>
          <button
            ref={btnExportZip}
            className="flex items-center gap-2 text-[12px] font-semibold py-1.5 px-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Download size={14} /> ZIP
          </button>
          <button
            ref={btnExportPdfRef}
            className="flex items-center gap-2 text-[12px] font-semibold py-1.5 px-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Download size={14} /> PDF
          </button>
          <button
            ref={btnExportSvgRef}
            className="flex items-center gap-2 text-[12px] font-semibold py-1.5 px-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Download size={14} /> SVG
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div
          ref={previewContainerRef}
          className="flex-1 overflow-auto p-8 flex justify-center items-baseline"
        >
          <div
            ref={pageRef}
            id="page"
            onContextMenu={handleContextMenu}
            onClick={handlePageClick}
            className="shadow-2xl origin-top transition-transform duration-200 min-w-[400px] min-h-[600px]"
          ></div>
        </div>

        <CommentsPanel />
      </div>

      {menu && <PreviewContextMenu menu={menu} onClose={() => setMenu(null)} />}
      <Footer position="absolute" />
    </div>
  );
};
