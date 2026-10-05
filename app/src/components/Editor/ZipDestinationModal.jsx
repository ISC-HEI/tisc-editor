import { useState } from 'react';

export function ZipDestinationModal({ zipName, defaultFolderName, folders, onConfirm, onCancel }) {
  const [mode, setMode] = useState('zipName');
  const [folderPath, setFolderPath] = useState(folders[0] ?? '');

  const noFolders = folders.length === 0;

  const optionClass = (value) =>
    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ' +
    (mode === value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Extract zip</h2>
          <p className="text-sm text-slate-600">
            Where should the contents of <span className="font-semibold">{zipName}</span> go?
          </p>

          <label className={optionClass('zipName')}>
            <input type="radio" checked={mode === 'zipName'} onChange={() => setMode('zipName')} />
            <span className="text-sm text-slate-700">
              In a new folder named <span className="font-semibold">{defaultFolderName}</span>
            </span>
          </label>

          <label className={optionClass('root')}>
            <input type="radio" checked={mode === 'root'} onChange={() => setMode('root')} />
            <span className="text-sm text-slate-700">At the project root</span>
          </label>

          <label
            className={optionClass('folder') + (noFolders ? ' opacity-40 pointer-events-none' : '')}
          >
            <input
              type="radio"
              checked={mode === 'folder'}
              disabled={noFolders}
              onChange={() => setMode('folder')}
            />
            <span className="flex-1 text-sm text-slate-700">
              In an existing folder
              <select
                value={folderPath}
                disabled={noFolders}
                onFocus={() => setMode('folder')}
                onChange={(e) => {
                  setFolderPath(e.target.value);
                  setMode('folder');
                }}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                {folders.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ mode, folderPath })}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Extract
          </button>
        </div>
      </div>
    </div>
  );
}
