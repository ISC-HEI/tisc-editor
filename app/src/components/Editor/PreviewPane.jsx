import { useEffect, useRef } from "react";
import { ZoomOut, ZoomIn, Download } from "lucide-react";
import { initPreviewRefs } from "@/hooks/refs";
import { useZoomWatcher } from "@/hooks/useZoom"

export const PreviewPane = () => {
  const btnInRef = useRef(null);
  const btnOutRef = useRef(null);
  const pageRef = useRef(null);
  const displayRef = useRef(null);

  const btnExportZip = useRef(null);
  const btnExportPdfRef = useRef(null);
  const btnExportSvgRef = useRef(null);
  useZoomWatcher();

  useEffect(() => {
    if (btnInRef.current && btnOutRef.current && pageRef.current && displayRef.current && btnExportPdfRef.current && btnExportSvgRef.current && btnExportZip.current) {
      initPreviewRefs({
        page: pageRef.current,

        btnExportZip: btnExportZip.current,
        btnExportPdf: btnExportPdfRef.current,
        btnExportSvg: btnExportSvgRef.current,

        btnZoomIn: btnInRef.current,
        btnZoomOut: btnOutRef.current,
        zoomLevelDisplay: displayRef.current
      });
    }
  }, []);

  return (
    <div className="flex-1 bg-slate-100 overflow-hidden flex flex-col">
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
          <button ref={btnExportZip} className="flex items-center gap-2 text-[12px] font-semibold py-1.5 px-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            <Download size={14} /> ZIP
          </button>
          <button ref={btnExportPdfRef} className="flex items-center gap-2 text-[12px] font-semibold py-1.5 px-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            <Download size={14} /> PDF
          </button>
          <button ref={btnExportSvgRef} className="flex items-center gap-2 text-[12px] font-semibold py-1.5 px-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            <Download size={14} /> SVG
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-8 flex justify-center items-baseline">
        <div 
          ref={pageRef}
          id="page"
          className="shadow-2xl origin-top transition-transform duration-200 bg-white min-w-[400px] min-h-[600px]"
        >
        </div>
      </div>
    </div>
  );
};