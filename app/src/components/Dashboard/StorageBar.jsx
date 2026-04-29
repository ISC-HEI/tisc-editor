"use client";
import { useState, useEffect } from "react";
import { getUserStorage } from "@/app/dashboard/actions";

export default function StorageBar() {
    const [storage, setStorage] = useState(null);

    useEffect(() => {
        
        getUserStorage().then(data => {
            if (data) setStorage(data);
        });
    }, []);

    if (!storage) return <div className="h-12 w-full bg-gray-50 animate-pulse rounded-lg" />;

    return (
        <div className="mt-auto p-4 border-t border-gray-100">
            <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Espace de stockage</span>
                <span className={`text-[10px] font-bold ${storage.percentage > 90 ? 'text-red-500' : 'text-gray-600'}`}>
                    {storage.percentage.toFixed(0)}%
                </span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-1000 ${storage.percentage > 90 ? 'bg-red-500' : 'bg-red-600'}`} 
                    style={{ width: `${storage.percentage}%` }}
                />
            </div>
            <p className="text-[9px] text-gray-400 mt-1 font-medium">
                {(storage.usage / 1024 / 1024).toFixed(1)} Mo / {(storage.limit / 1024 / 1024).toFixed(0)} Mo
            </p>
        </div>
    );
}