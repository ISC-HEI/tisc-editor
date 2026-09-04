"use client";
import { HardDrive } from "lucide-react";
import { useState } from "react";

export default function StorageBar({ storage }) {
  const [isHovered, setIsHovered] = useState(false);

  if (!storage) {
    return <div className="h-10 w-10 rounded-full bg-gray-100 animate-pulse" />;
  }

  const isCritical = storage.percentage > 90;
  const isWarning = storage.percentage > 70 && !isCritical;

  const ringColor = isCritical ? "#ef4444" : isWarning ? "#f59e0b" : "#2563eb";
  const bgColor = isCritical ? "bg-red-50" : isWarning ? "bg-amber-50" : "bg-blue-50";
  const textColor = isCritical ? "text-red-600" : isWarning ? "text-amber-600" : "text-blue-600";

  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(storage.percentage, 100) / 100) * circumference;

  const usedMo = (storage.usage / 1024 / 1024).toFixed(1);
  const limitMo = (storage.limit / 1024 / 1024).toFixed(0);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`relative h-10 w-10 rounded-full ${bgColor} flex items-center justify-center cursor-default`}>
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-white" />
          <circle
            cx="20" cy="20" r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <HardDrive size={14} className={textColor} />
      </div>

      {isHovered && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 shadow-xl rounded-xl p-3 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Storage</span>
            <span className={`text-xs font-bold ${textColor}`}>{storage.percentage.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(storage.percentage, 100)}%`, backgroundColor: ringColor }}
            />
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            {usedMo} Mo / {limitMo} Mo
          </p>
        </div>
      )}
    </div>
  );
}