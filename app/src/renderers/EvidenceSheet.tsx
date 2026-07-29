/**
 * The evidence sheet, ported from the zip's `shEv` sheet, and the two helpers that open it.
 *
 * Blueprint 6.8 as adjudicated for this gate: every element carrying an `el_id` is focusable and
 * opens its evidence sheet. That is more surface than the zip made tappable, and it is one
 * helper (`elProps`) rather than a per-component decision, so no element can quietly opt out.
 *
 * The sheet is one layout for every caller. What varies is the payload: a pill, an optional
 * title, the Values behind it, the quoted or transcribed body, why the status is what it is, and
 * the resolved registry entries. Nothing here authors evidence; every field arrives resolved.
 */
import { useCallback, useEffect, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import type { Source, Value } from '../../../contracts/types';
// The trap is a leaf DOM utility with no app imports of its own, so the renderer layer can take
// it without taking the shell: the sheet is the one renderer that owns an overlay.
import { trapRef } from '../trap';
import { t, type ElStatus, type RenderCtx } from './ctx';
import { STATUS_LABEL, UI } from './copy';
import ValueText from './ValueText';

export interface SheetPayload {
  /** Drives the pill colour and its stroke. Absent for evidence that carries no status. */
  status?: ElStatus;
  /** Pill text. */
  label: string;
  title?: string;
  values?: Value[];
  /** Quotations and transcribed lines, in reading order. */
  body?: string[];
  why?: string;
  whyLabel?: string;
  sources?: Source[];
}

/**
 * A panel frame's own sheet: what the panel is, and every source behind it. `sources` is the
 * array the panel already resolved at the top of its render, which is where the panel-scoped
 * orphan refusal happens; the frame sheet only displays it.
 */
export const panelSheet = (ctx: RenderCtx, title: string, body: string[], sources: Source[]): SheetPayload => ({
  label: t(ctx, UI.panelSources),
  title,
  body,
  sources,
});

/**
 * `data-el`, focus, and the tap that opens the sheet, in one spread. `role` drops to "group" for
 * panel frames: a frame contains its own tappable rows, and interactive content nested inside
 * role="button" is unreachable in some assistive technology.
 *
 * `open` is null in a still context (`RenderCtx.still`), and then the element keeps its identity
 * and loses its affordance: `data-el` still names it for a highlight or a test, and there is no
 * tab stop, no announced role and no handler. One guard here rather than a decision per renderer,
 * because every addressable element in the layer arrives through this function.
 */
export function elProps(
  elId: string,
  open: ((payload: SheetPayload) => void) | null,
  payload: () => SheetPayload,
  role: 'button' | 'group' = 'button',
) {
  if (open === null) return { 'data-el': elId };

  const fire = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
    open(payload());
  };
  return {
    'data-el': elId,
    tabIndex: 0,
    role,
    onClick: fire,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      fire(event);
    },
  };
}

/**
 * One sheet per component instance. Returns the opener and the element to render, and returns no
 * opener at all in a still context, which is what makes `elProps` draw an element rather than a
 * control. The hooks above it run either way: still is a property of one render, not a build flag.
 */
export function useEvidenceSheet(ctx: RenderCtx): {
  open: ((payload: SheetPayload) => void) | null;
  sheet: ReactNode;
} {
  const [payload, setPayload] = useState<SheetPayload | null>(null);
  const open = useCallback((next: SheetPayload) => {
    setPayload(next);
  }, []);
  const close = useCallback(() => {
    setPayload(null);
  }, []);
  return {
    open: ctx.still === true ? null : open,
    sheet: payload === null ? null : <EvidenceSheet payload={payload} ctx={ctx} onClose={close} />,
  };
}

export function EvidenceSheet({
  payload,
  ctx,
  onClose,
}: {
  payload: SheetPayload;
  ctx: RenderCtx;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const { status, label, title, values, body, why, whyLabel, sources } = payload;
  return (
    <>
      <div className="m-scrim" onClick={onClose} />
      {/* The Gate 2 ruling, settled at Gate 3: `aria-modal="true"` promises everything outside
          is inert, and app/src/trap.ts is the trap that keeps the promise. Trap and attribute
          landed together, as the ruling required. */}
      <div
        className="m-sheet"
        data-testid="evidence-sheet"
        role="dialog"
        aria-modal="true"
        ref={trapRef}
        aria-label={title ?? label}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="m-grab" />
        {status === undefined ? (
          <span className="m-pill">{label}</span>
        ) : (
          <span className="m-pill m-pill-st" data-st={status}>
            {label}
          </span>
        )}
        {title === undefined ? null : <div className="m-sheet-title">{title}</div>}
        {values === undefined || values.length === 0 ? null : (
          <div className="m-sheet-vals">
            {values.map((value) => (
              <div key={value.source_id + value.display.en} className="m-sheet-val">
                <ValueText value={value} ctx={ctx} />
                {(value.flags ?? []).map((flag) => (
                  <span key={flag} className="m-flag">
                    {flag.replace('_', ' ')}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
        {(body ?? []).map((line) => (
          <div key={line} className="m-sheet-body">
            {line}
          </div>
        ))}
        {sources === undefined || sources.length === 0 ? null : (
          <>
            <div className="m-sheet-label">{t(ctx, UI.sourceHeading)}</div>
            {sources.map((source) => (
              <div key={source.id} className="m-sheet-source">
                <span className="m-sheet-pub">{source.publisher}</span>
                {source.self_reported ? <span className="m-selfrep">{t(ctx, UI.selfReported)}</span> : null}
                <div className="m-sheet-srctitle">{source.title}</div>
                <div className="m-sheet-srcmeta">
                  {source.period} · {source.kind} · retrieved {source.retrieved_at}
                </div>
              </div>
            ))}
          </>
        )}
        {why === undefined ? null : (
          <>
            <div className="m-sheet-label">{whyLabel ?? t(ctx, UI.whyThisStatus)}</div>
            <div className="m-sheet-why">{why}</div>
          </>
        )}
        <div className="m-sheet-foot">
          {t(ctx, UI.sheetFooterA)}
          <br />
          {t(ctx, UI.sheetFooterB)}
        </div>
        {/* This sheet is otherwise all paragraphs: no tab stop, so a keyboard reader is handed a
            trap whose only exit is a key nothing on screen names. The trap and Escape are
            unchanged; this is the exit made visible. */}
        <button type="button" className="m-sheet-close" onClick={onClose}>
          {t(ctx, UI.close)}
        </button>
      </div>
    </>
  );
}

/** The pill label for a status, so the sheet and the legend never drift apart. */
export const statusLabel = (ctx: RenderCtx, status: ElStatus): string => t(ctx, STATUS_LABEL[status]);
