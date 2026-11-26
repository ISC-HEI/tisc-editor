import { ChevronLeft, FileText, Loader2, Share2, Users } from 'lucide-react';
import { SignOutButton } from '../SignOutButton';
import { useCallback, useEffect, useRef, useState } from 'react';
import { initPreviewRefs } from '@/hooks/refs';
import SharedUserWindow from '../Dashboard/SharedUserWindow';
import { getProjectShareData } from '@/lib/actions/sharing';

export const EditorHeader = ({ projectId, title, tags = [], role }) => {
  const userCountRef = useRef(null);
  const userListContainerRef = useRef(null);

  const isOwner = role === 'owner';
  const [isSharing, setIsSharing] = useState(false);
  const [isLoadingShare, setIsLoadingShare] = useState(false);
  const [shareData, setShareData] = useState(null);

  const loadShareData = useCallback(async () => {
    const data = await getProjectShareData(projectId);
    setShareData(data);
  }, [projectId]);

  const handleOpenShare = async () => {
    if (isLoadingShare) return;
    setIsLoadingShare(true);
    try {
      await loadShareData();
      setIsSharing(true);
    } catch (err) {
      console.error('Share error:', err);
    } finally {
      setIsLoadingShare(false);
    }
  };

  const handleShareChange = () => {
    loadShareData().catch((err) => console.error('Share error:', err));
  };

  const handleRemoveSuccess = (email) => {
    setShareData((prev) =>
      prev ? { ...prev, users: prev.users.filter((u) => u.email !== email) } : prev,
    );
  };

  useEffect(() => {
    if (userCountRef.current && userListContainerRef.current) {
      initPreviewRefs({
        userCount: userCountRef.current,
        userListContainer: userListContainerRef.current,
      });
    }
  }, []);

  return (
    <header className="h-14 border-b border-slate-200 flex items-center justify-between px-4 shrink-0 bg-white z-10">
      <div className="flex items-center gap-4 flex-1">
        <a
          href="/dashboard"
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          title="Back to Dashboard"
        >
          <ChevronLeft size={20} />
        </a>
        <div className="h-6 w-[1px] bg-slate-200 mx-1" />
        <div className="flex items-center gap-2">
          <div className="bg-blue-50 text-blue-600 p-1.5 rounded">
            <FileText size={16} />
          </div>
          <h1 className="font-semibold text-sm tracking-tight" data-test="editor-title">
            {title}
          </h1>
          <div className="flex items-center gap-1.5 ml-2">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md"
              >
                #{tag.name}
              </span>
            ))}

            {tags.length > 3 && (
              <span className="text-[10px] font-semibold text-slate-400">+{tags.length - 3}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 flex-1">
        <div className="relative group">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full shadow-sm cursor-default hover:bg-slate-100 transition-colors">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </div>
            <span className="text-[11px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={12} className="text-slate-400" />
              <span ref={userCountRef}>1</span> Active
            </span>
          </div>

          <div className="absolute top-full mt-2 hidden group-hover:block w-max max-w-xs bg-white border border-slate-200 shadow-xl rounded-lg py-2 z-[110] animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="px-3 py-1 border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Users online
            </div>
            <div
              ref={userListContainerRef}
              className="max-h-48 overflow-y-auto px-1 py-1 flex flex-col gap-0.5"
            ></div>
          </div>
        </div>
        {isOwner && (
          <button
            type="button"
            onClick={handleOpenShare}
            disabled={isLoadingShare}
            data-test="editor-share-button"
            title="Share project"
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 disabled:opacity-60 rounded-full transition-colors"
          >
            {isLoadingShare ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
          </button>
        )}
      </div>
      <div className="flex items-center justify-end gap-3 flex-1">
        <SignOutButton />
      </div>

      {isSharing && shareData && (
        <SharedUserWindow
          projectId={projectId}
          title={title}
          users={shareData.users}
          pendingRequests={shareData.pendingRequests}
          onClose={() => setIsSharing(false)}
          onRemoveSuccess={handleRemoveSuccess}
          onShareSuccess={handleShareChange}
        />
      )}
    </header>
  );
};
