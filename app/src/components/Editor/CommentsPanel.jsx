import { useEffect, useRef, useState } from 'react';
import { Check, EyeOff, MessageSquare, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { MAX_COMMENT_LENGTH } from '@/lib/comment-anchors';
import { functions } from '@/hooks/refs';
import {
  canComment,
  canModerate,
  cancelDraft,
  removeComment,
  resolveAnchor,
  setActiveThread,
  setFilter,
  setPanelOpen,
  submitDraft,
  submitReply,
  toggleResolved,
  useComments,
} from '@/hooks/useComments';

function timeAgo(date) {
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(date).toLocaleDateString();
}

function Avatar({ user }) {
  const label = user?.name || user?.email || '?';
  return (
    <div className="h-7 w-7 shrink-0 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px] uppercase">
      {label.charAt(0)}
    </div>
  );
}

/**
 * Auto-growing textarea: Enter submits, Shift+Enter inserts a new line.
 */
function Composer({ placeholder, submitLabel, onSubmit, onCancel, autoFocus = false }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const submit = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    const ok = await onSubmit(value);
    setBusy(false);
    if (ok) setValue('');
  };

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <textarea
        ref={ref}
        value={value}
        maxLength={MAX_COMMENT_LENGTH}
        rows={2}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape' && onCancel) {
            onCancel();
          }
        }}
        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-xs font-semibold text-slate-600 rounded-lg hover:bg-slate-100"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={!value.trim() || busy}
          onClick={submit}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Send size={12} /> {submitLabel}
        </button>
      </div>
    </div>
  );
}

function CommentBody({ comment, onDelete }) {
  const author = comment.author?.name || comment.author?.email || 'Unknown user';
  return (
    <div className="group/comment flex gap-2">
      <Avatar user={comment.author} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-semibold text-slate-700">{author}</span>
          <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(comment.createdAt)}</span>
          {onDelete && (
            <button
              type="button"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="ml-auto p-1 text-slate-300 rounded hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/comment:opacity-100 focus:opacity-100"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-700">
          {comment.body}
        </p>
      </div>
    </div>
  );
}

function Thread({ thread, state }) {
  const active = state.activeId === thread.id;
  const visible = Boolean(resolveAnchor(thread));
  const confirmDelete = async (message, commentId) => {
    const ok = functions.openCustomConfirm
      ? await functions.openCustomConfirm('Delete comment', message)
      : window.confirm(message);
    if (ok) removeComment(commentId);
  };

  return (
    <li
      onClick={() => setActiveThread(thread.id, { scroll: visible && !thread.resolved })}
      className={`rounded-xl border bg-white p-3 space-y-3 cursor-pointer transition-colors ${
        active ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
        {thread.resolved ? (
          <span className="text-emerald-600">
            Resolved
            {thread.resolvedBy &&
              ` by ${thread.resolvedBy.name || thread.resolvedBy.email.split('@')[0]}`}
          </span>
        ) : !visible ? (
          <span className="flex items-center gap-1 text-slate-400">
            <EyeOff size={11} /> Not visible in preview
          </span>
        ) : null}

        {canModerate(thread, state) && (
          <button
            type="button"
            title={thread.resolved ? 'Reopen' : 'Resolve'}
            onClick={(e) => {
              e.stopPropagation();
              toggleResolved(thread);
            }}
            className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full normal-case tracking-normal text-[11px] text-slate-600 hover:bg-slate-100"
          >
            {thread.resolved ? <RotateCcw size={12} /> : <Check size={12} />}
            {thread.resolved ? 'Reopen' : 'Resolve'}
          </button>
        )}
      </div>

      <CommentBody
        comment={thread}
        onDelete={
          canModerate(thread, state)
            ? () => confirmDelete('Delete this comment and all its replies?', thread.id)
            : null
        }
      />

      {thread.replies.length > 0 && (
        <div className="space-y-3 border-l-2 border-slate-100 pl-3">
          {thread.replies.map((reply) => (
            <CommentBody
              key={reply.id}
              comment={reply}
              onDelete={
                canModerate(reply, state)
                  ? () => confirmDelete('Delete this reply?', reply.id)
                  : null
              }
            />
          ))}
        </div>
      )}

      {active && !thread.resolved && canComment(state) && (
        <Composer
          placeholder="Reply…"
          submitLabel="Reply"
          onSubmit={(body) => submitReply(thread.id, body)}
        />
      )}
    </li>
  );
}

export function CommentsPanel() {
  const state = useComments();
  if (!state.panelOpen) return null;

  const open = state.threads.filter((t) => !t.resolved);
  const resolved = state.threads.filter((t) => t.resolved);
  const shown = state.filter === 'open' ? open : resolved;

  const tabClass = (value) =>
    `flex-1 py-1 text-xs font-semibold rounded-md transition-colors ${
      state.filter === value ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500'
    }`;

  return (
    <aside className="w-80 shrink-0 border-l border-slate-200 bg-slate-50 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-4 h-11 border-b border-slate-200 bg-white shrink-0">
        <MessageSquare size={15} className="text-slate-500" />
        <span className="text-sm font-semibold text-slate-700">Comments</span>
        <button
          type="button"
          title="Close"
          onClick={() => setPanelOpen(false)}
          className="ml-auto p-1 text-slate-400 rounded hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-3 shrink-0">
        <div className="flex bg-slate-200/70 rounded-lg p-0.5">
          <button type="button" className={tabClass('open')} onClick={() => setFilter('open')}>
            Open ({open.length})
          </button>
          <button
            type="button"
            className={tabClass('resolved')}
            onClick={() => setFilter('resolved')}
          >
            Resolved ({resolved.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-16 space-y-3">
        {state.draft && (
          <div className="rounded-xl border border-blue-400 ring-2 ring-blue-100 bg-white p-3">
            <Composer
              autoFocus
              placeholder="Add a comment…"
              submitLabel="Comment"
              onSubmit={submitDraft}
              onCancel={cancelDraft}
            />
          </div>
        )}

        {shown.length === 0 && !state.draft ? (
          <p className="pt-8 px-4 text-center text-xs text-slate-400 italic">
            {state.filter === 'open'
              ? canComment(state)
                ? 'No open comments. Right-click on the preview to add one.'
                : 'No open comments.'
              : 'No resolved comments.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {shown.map((thread) => (
              <Thread key={thread.id} thread={thread} state={state} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
