import { useSyncExternalStore } from 'react';
import { refs } from './refs';
import { debounce, makeToast } from './useUtils';
import { fileTree, getSyncMarkers, scrollToSyncMarker } from './useEditor';
import { findMainFile } from './useApi';
import {
  createComment,
  deleteComment,
  listComments,
  replyToComment,
  setCommentResolved,
  shiftCommentAnchors,
} from '@/lib/actions/comments';
import {
  COMMENT_ROLES,
  EDIT_ROLES,
  applyLineChanges,
  normalizeFilePath,
  toLineChanges,
} from '@/lib/comment-anchors';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Comment threads live in a small external store (rather than React state)
 * because they are read both by React components and by the imperative
 * preview code that draws the pins inside the rendered SVG.
 */
let state = {
  projectId: null,
  userId: null,
  role: null,
  threads: [],
  loaded: false,
  panelOpen: false,
  filter: 'open',
  activeId: null,
  draft: null,
};

const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
  renderCommentPins();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useComments() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

// ----------------------------------------
// Permissions (mirrors the server checks in lib/actions/comments.ts)
// ----------------------------------------

export const canComment = (s = state) => COMMENT_ROLES.includes(s.role);
export const canModerate = (comment, s = state) =>
  s.role === 'owner' || comment?.author?.id === s.userId;

// ----------------------------------------
// Lifecycle
// ----------------------------------------

let onRendered = null;

export function initComments({ projectId, userId, role }) {
  state = { ...state, projectId, userId, role, threads: [], loaded: false, draft: null };

  if (onRendered) window.removeEventListener('tisc:preview-rendered', onRendered);
  onRendered = () => renderCommentPins();
  window.addEventListener('tisc:preview-rendered', onRendered);

  loadComments();

  return () => {
    window.removeEventListener('tisc:preview-rendered', onRendered);
    onRendered = null;
  };
}

export async function loadComments() {
  if (!state.projectId) return;
  try {
    const threads = await listComments(state.projectId);
    const activeId = threads.some((t) => t.id === state.activeId) ? state.activeId : null;
    setState({ threads, loaded: true, activeId });
  } catch (err) {
    console.warn('Failed to load comments:', err);
  }
}

function notifyOthers(created = false) {
  refs.socket?.emit('comments-changed', { docId: state.projectId, created });
}

async function runAction(action, { created = false } = {}) {
  try {
    await action();
    notifyOthers(created);
    await loadComments();
    return true;
  } catch (err) {
    makeToast(err?.message || 'Comment action failed', 'error');
    return false;
  }
}

// ----------------------------------------
// Panel / UI state
// ----------------------------------------

export function setPanelOpen(panelOpen) {
  setState({ panelOpen, draft: panelOpen ? state.draft : null });
}

export function setFilter(filter) {
  setState({ filter });
}

export function setActiveThread(activeId, { scroll = true } = {}) {
  setState({ activeId, panelOpen: activeId ? true : state.panelOpen });
  if (!activeId || !scroll) return;

  const thread = state.threads.find((t) => t.id === activeId);
  const position = thread && resolveAnchor(thread);
  if (position) scrollToSyncMarker(position, 'smooth');
}

export function startDraft(anchor) {
  setState({ draft: anchor, panelOpen: true, activeId: null, filter: 'open' });
}

export function cancelDraft() {
  setState({ draft: null });
}

// ----------------------------------------
// Actions
// ----------------------------------------

export async function submitDraft(body) {
  const anchor = state.draft;
  if (!anchor) return false;

  let createdId = null;
  const ok = await runAction(
    async () => {
      const result = await createComment(state.projectId, body, anchor);
      createdId = result.id;
    },
    { created: true },
  );

  if (ok) setState({ draft: null, activeId: createdId });
  return ok;
}

export const submitReply = (threadId, body) =>
  runAction(() => replyToComment(threadId, body), { created: true });

export const toggleResolved = (thread) =>
  runAction(() => setCommentResolved(thread.id, !thread.resolved));

export const removeComment = (commentId) => runAction(() => deleteComment(commentId));

// ----------------------------------------
// Anchors: preview point <-> (source line + offset)
// ----------------------------------------

function getMainFilePath() {
  return normalizeFilePath(findMainFile(fileTree) || 'main.typ');
}

function getPageGroups() {
  const svg = refs.page?.querySelector('svg');
  return svg ? Array.from(svg.querySelectorAll('g.typst-page')) : [];
}

/**
 * Converts a click (client coordinates) into a point on a rendered page,
 * in pt. Returns null if the click is outside every page.
 */
function clientToPagePoint(clientX, clientY) {
  const svg = refs.page?.querySelector('svg');
  if (!svg) return null;

  const pages = getPageGroups();
  for (let i = 0; i < pages.length; i++) {
    const ctm = pages[i].getScreenCTM?.();
    if (!ctm) continue;

    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const local = point.matrixTransform(ctm.inverse());

    const width = parseFloat(pages[i].getAttribute('data-page-width')) || 0;
    const height = parseFloat(pages[i].getAttribute('data-page-height')) || 0;

    if (local.x >= 0 && local.x <= width && local.y >= 0 && local.y <= height) {
      return { page: i + 1, x: local.x, y: local.y };
    }
  }
  return null;
}

/**
 * Builds an anchor for a click on the preview: the closest sync marker above
 * the click (same page first, then previous pages), plus an offset.
 */
export function anchorFromClientPoint(clientX, clientY) {
  const point = clientToPagePoint(clientX, clientY);
  if (!point) return null;

  const filePath = getMainFilePath();
  const markers = getSyncMarkers() || [];

  const byPosition = (a, b) => a.page - b.page || a.y - b.y;
  const above = markers
    .filter((m) => m.page < point.page || (m.page === point.page && m.y <= point.y))
    .sort(byPosition)
    .pop();

  if (above) {
    const pageOffset = point.page - above.page;
    return {
      filePath,
      line: above.line,
      pageOffset,
      x: point.x,
      dy: pageOffset === 0 ? point.y - above.y : point.y,
    };
  }

  const below = markers.filter((m) => m.page === point.page).sort(byPosition)[0];
  if (below) {
    return { filePath, line: below.line, pageOffset: 0, x: point.x, dy: point.y - below.y };
  }

  return { filePath, line: null, pageOffset: point.page, x: point.x, dy: point.y };
}

/**
 * Resolves an anchor to { page, x, y } in the current preview, or null when
 * it can't be placed (other main file, no pages, ...).
 */
export function resolveAnchor(anchor) {
  if (!anchor || anchor.filePath !== getMainFilePath()) return null;

  const pageCount = getPageGroups().length;
  if (pageCount === 0) return null;

  const clampPage = (page) => Math.min(Math.max(page, 1), pageCount);

  if (anchor.line === null || anchor.line === undefined) {
    return { page: clampPage(anchor.pageOffset), x: anchor.x, y: anchor.dy };
  }

  const markers = getSyncMarkers() || [];
  const exact = markers.find((m) => m.line === anchor.line);

  if (exact) {
    const page = clampPage(exact.page + anchor.pageOffset);
    const y = anchor.pageOffset === 0 ? exact.y + anchor.dy : anchor.dy;
    return { page, x: anchor.x, y };
  }

  // The anchored paragraph is gone: fall back to the closest paragraph above.
  let fallback = null;
  for (const m of markers) {
    if (m.line <= anchor.line && (!fallback || m.line > fallback.line)) fallback = m;
  }
  fallback = fallback || markers[0];
  if (!fallback) return null;

  return { page: fallback.page, x: anchor.x, y: fallback.y };
}

// ----------------------------------------
// Pins drawn inside the SVG (so zoom, scroll and page gaps just work)
// ----------------------------------------

function createPin({ id, x, y, color, title, isDraft }) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'tisc-comment-pin');
  g.setAttribute('transform', `translate(${x}, ${y})`);
  g.style.cursor = 'pointer';
  if (id) g.dataset.commentId = id;
  if (isDraft) g.dataset.draft = 'true';

  const bubble = document.createElementNS(SVG_NS, 'path');
  bubble.setAttribute(
    'd',
    'M0 0 L0 -14 Q0 -18 4 -18 L18 -18 Q22 -18 22 -14 L22 -8 Q22 -4 18 -4 L6 -4 Z',
  );
  bubble.setAttribute('fill', color);
  bubble.setAttribute('stroke', '#ffffff');
  bubble.setAttribute('stroke-width', '1.2');
  bubble.style.filter = 'drop-shadow(0 1px 1.5px rgba(15, 23, 42, 0.35))';
  g.appendChild(bubble);

  for (const lineY of [-13.5, -9.5]) {
    const line = document.createElementNS(SVG_NS, 'rect');
    line.setAttribute('x', '5');
    line.setAttribute('y', String(lineY));
    line.setAttribute('width', lineY < -10 ? '12' : '8');
    line.setAttribute('height', '1.6');
    line.setAttribute('rx', '0.8');
    line.setAttribute('fill', '#ffffff');
    g.appendChild(line);
  }

  if (title) {
    const titleEl = document.createElementNS(SVG_NS, 'title');
    titleEl.textContent = title;
    g.appendChild(titleEl);
  }

  return g;
}

export function renderCommentPins() {
  if (typeof document === 'undefined') return;

  const pages = getPageGroups();
  refs.page?.querySelectorAll('.tisc-comment-pin').forEach((pin) => pin.remove());
  if (pages.length === 0) return;

  const place = (anchor, options) => {
    const position = resolveAnchor(anchor);
    if (!position) return;
    pages[position.page - 1]?.appendChild(createPin({ ...options, x: position.x, y: position.y }));
  };

  for (const thread of state.threads) {
    if (thread.resolved) continue;
    const active = thread.id === state.activeId;
    const author = thread.author?.name || thread.author?.email || '';
    const preview = thread.body.length > 80 ? `${thread.body.slice(0, 80)}…` : thread.body;

    place(thread, {
      id: thread.id,
      color: active ? '#2563eb' : '#f59e0b',
      title: `${author}: ${preview}`,
    });
  }

  if (state.draft) {
    place(state.draft, { color: '#2563eb', isDraft: true, title: 'New comment' });
  }
}

// ----------------------------------------
// Keeping anchored lines in sync with edits
// ----------------------------------------

const MAX_CHANGES_PER_CALL = 500;
let pendingShifts = [];
let flushing = Promise.resolve();

const scheduleFlush = debounce(() => {
  const batch = pendingShifts;
  pendingShifts = [];
  if (batch.length === 0 || !state.projectId) return;

  const projectId = state.projectId;
  flushing = flushing.then(async () => {
    for (const { filePath, changes } of batch) {
      for (let i = 0; i < changes.length; i += MAX_CHANGES_PER_CALL) {
        try {
          await shiftCommentAnchors(
            projectId,
            filePath,
            changes.slice(i, i + MAX_CHANGES_PER_CALL),
          );
        } catch (err) {
          console.warn('Failed to shift comment anchors:', err);
        }
      }
    }
  });
}, 800);

/**
 * Applies a Monaco edit to the anchored lines of the local threads.
 * `persist` is true for edits made by this client: it is then responsible
 * for saving the shift (other clients apply the same shift on remote-edit).
 */
export function trackCommentEdit(filename, monacoChanges, persist) {
  const filePath = normalizeFilePath(filename);
  const changes = toLineChanges(monacoChanges);
  if (changes.length === 0) return;

  const concerned = state.threads.some((t) => t.filePath === filePath && t.line !== null);
  const draftConcerned = state.draft?.filePath === filePath && state.draft.line !== null;
  if (!concerned && !draftConcerned) return;

  const shift = (anchor) => {
    if (anchor.filePath !== filePath || anchor.line === null) return anchor;
    const line = Math.max(0, applyLineChanges(anchor.line, changes));
    return line === anchor.line ? anchor : { ...anchor, line };
  };

  setState({
    threads: state.threads.map(shift),
    draft: draftConcerned ? shift(state.draft) : state.draft,
  });

  if (persist && concerned && EDIT_ROLES.includes(state.role)) {
    const last = pendingShifts[pendingShifts.length - 1];
    if (last?.filePath === filePath) last.changes.push(...changes);
    else pendingShifts.push({ filePath, changes: [...changes] });
    scheduleFlush();
  }
}
