import { ZoomOut, ZoomIn, Download } from "lucide-react";

export const PreviewPane = () => (
  <div className="flex-1 bg-slate-100 overflow-hidden flex flex-col">
    <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center bg-slate-100 rounded-lg p-1">
        <button id="btnZoomOut" className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-slate-600"><ZoomOut size={16} /></button>
        <span id="zoomLevel" className="text-[11px] font-bold px-3 min-w-[50px] text-center text-slate-500">100%</span>
        <button id="btnZoomIn" className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-slate-600"><ZoomIn size={16} /></button>
      </div>
      
      <div className="flex gap-2">
        <button id="btnExportPdf" className="flex items-center gap-2 text-[12px] font-semibold py-1.5 px-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">
          <Download size={14} /> PDF
        </button>
        <button id="btnExportSvg" className="flex items-center gap-2 text-[12px] font-semibold py-1.5 px-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">
          <Download size={14} /> SVG
        </button>
      </div>
    </div>
    
    <div id="preview" className="flex-1 overflow-auto p-8 flex justify-center">
      <div id="page" className="bg-white shadow-2xl origin-top transition-transform duration-200 min-h-[29.7cm] w-[21cm]"></div>
    </div>
  </div>
);