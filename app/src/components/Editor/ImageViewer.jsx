import { useEffect, useState } from 'react';

export function ImageViewer() {
  const [image, setImage] = useState(null);

  useEffect(() => {
    const handleOpenImage = (event) => {
      setImage(event.detail);
    };

    window.addEventListener('open-image', handleOpenImage);

    return () => {
      window.removeEventListener('open-image', handleOpenImage);
    };
  }, []);

  if (!image) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
      <div className="flex items-center justify-between bg-white px-4 py-3">
        <span className="font-medium">{image.name}</span>

        <button onClick={() => setImage(null)} className="rounded px-3 py-1 hover:bg-gray-100">
          Close
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto p-6">
        <img src={image.src} alt={image.name} className="max-h-full max-w-full object-contain" />
      </div>
    </div>
  );
}
