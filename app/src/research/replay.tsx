/**
 * The replay console: one narrative's REAL recorded editorial run, replayed line by line in a
 * glass pane over the desk. docs/replay-protocol.md is the contract this file implements.
 *
 * Honesty of simulation (blueprint 3.4), the three rules that shape everything here:
 *
 *   1. Every fact on screen is `content/replay.json`: the roles, the labels, the model ids, the
 *      block reasons, the pass summaries, the token prefix. The only strings this module adds
 *      are chrome (headings, the refix connective, the scan invitation), and they come from the
 *      i18n bundles like every other piece of chrome in the product.
 *   2. The disclosure string from the record stays visible for the entire replay. It is pinned
 *      above the timeline, outside the typewriter, so no pacing state can hide it.
 *   3. The pacing is theatre and says so: 24 ms per character, 180 ms between lines (the design
 *      direction's numbers). Under reduced motion the completed timeline renders at once.
 *
 * When the replay reaches its `published` event the console renders the terminal state: the
 * recorded token prefix, a QR for `${SITE_URL}/n/{id}?published=1` (the cross-device channel;
 * a static host cannot push), the scan invitation, and one message on BroadcastChannel
 * `mth-updates`, `{ type: 'published', narrative_id, at }`, which is the same-machine channel
 * the app shell listens on. Once per replay, at the moment the published state appears.
 *
 * `uqr` is imported lazily here and nowhere else, so no other route pays for the encoder
 * (blueprint 7.5; the dependency ruling is quoted in docs/replay-protocol.md).
 */
import { useEffect, useRef, useState } from 'react';
import type { Lang, ReplayRun } from '../../../contracts/types';
import { translate, type Key } from '../i18n';
import { trapRef } from '../trap';
import { SITE_URL } from '../site';

export interface ConsoleLine {
  kind: 'slot' | 'block' | 'refix' | 'verdict';
  text: string;
}

type T = (key: Key, vars?: Record<string, string | number>) => string;

/**
 * The recorded events as console lines, in the record's own order. The one line the record does
 * not carry is the refix connective: a block followed by a pass on the same gate can only mean
 * the candidate went back and returned, and the chrome says that once per block round rather
 * than leaving the two adjacent lines to contradict each other.
 */
export function consoleLines(run: ReplayRun, lang: Lang, t: T): { lines: ConsoleLine[]; token: string | null } {
  const lines: ConsoleLine[] = [];
  let token: string | null = null;
  let blocked = false;
  for (const event of run.events) {
    if (blocked && event.kind !== 'block') {
      lines.push({ kind: 'refix', text: t('research.replay.refix') });
      blocked = false;
    }
    if (event.kind === 'slot') {
      lines.push({ kind: 'slot', text: `${event.role} · ${event.label[lang]} · ${event.model}` });
    } else if (event.kind === 'block') {
      lines.push({
        kind: 'block',
        text: `${t('research.replay.block', { gate: event.gate, model: event.judged_by })} ${event.reason}`,
      });
      blocked = true;
    } else if (event.kind === 'verdict') {
      const head = t('research.replay.pass', { gate: event.gate, model: event.model });
      lines.push({ kind: 'verdict', text: event.summary === '' ? head : `${head} ${event.summary}` });
    } else {
      token = event.token;
    }
  }
  return { lines, token };
}

/** One `h1v1h-1z` square per dark module; the matrix already carries its quiet-zone border. */
const qrPath = (data: boolean[][]): string => {
  let d = '';
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) d += `M${String(x)} ${String(y)}h1v1h-1z`;
    });
  });
  return d;
};

interface QrMatrix {
  size: number;
  data: boolean[][];
}

export interface ReplayConsoleProps {
  run: ReplayRun;
  runId: string;
  disclosure: string;
  lang: Lang;
  onClose: () => void;
}

/** 24 ms per character, 180 ms line pauses: the design direction's numbers, verbatim. */
const CHAR_MS = 24;
const LINE_MS = 180;

export default function ReplayConsole({ run, runId, disclosure, lang, onClose }: ReplayConsoleProps) {
  const t: T = (key, vars) => translate(lang, key, vars);
  const { lines, token } = consoleLines(run, lang, t);

  // Read once at mount: a preference flipped mid-replay applies to the next one.
  const [instant] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [at, setAt] = useState(() => (instant ? { line: lines.length, chars: 0 } : { line: 0, chars: 0 }));
  const done = at.line >= lines.length;

  useEffect(() => {
    if (done) return;
    const current = lines[at.line];
    if (current === undefined) return;
    const finished = at.chars >= current.text.length;
    const timer = setTimeout(
      () => {
        setAt(finished ? { line: at.line + 1, chars: 0 } : { line: at.line, chars: at.chars + 1 });
      },
      finished ? LINE_MS : CHAR_MS,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [at, done, lines]);

  // The published state: broadcast once, and only when the replay actually reached its token.
  const posted = useRef(false);
  useEffect(() => {
    if (!done || token === null || posted.current) return;
    posted.current = true;
    const channel = new BroadcastChannel('mth-updates');
    channel.postMessage({ type: 'published', narrative_id: run.narrative_id, at: new Date().toISOString() });
    channel.close();
  }, [done, token, run.narrative_id]);

  const url = `${SITE_URL}/n/${run.narrative_id}?published=1`;
  const [qr, setQr] = useState<QrMatrix | null>(null);
  useEffect(() => {
    if (!done || token === null) return;
    let live = true;
    void import('uqr').then(({ encode }) => {
      if (live) setQr(encode(url, { border: 2 }));
    });
    return () => {
      live = false;
    };
  }, [done, token, url]);

  // The pane scrolls to keep the line being typed in view, the way a terminal follows its tail.
  const tail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tail.current?.scrollIntoView({ block: 'nearest' });
  }, [at, qr]);

  return (
    <div className="m-rp" data-testid="replay-console">
      <div
        className="m-rp-scrim"
        aria-hidden="true"
        onClick={() => {
          onClose();
        }}
      />
      <div
        className="m-rp-pane g-glass"
        role="dialog"
        aria-modal="true"
        aria-label={t('research.replay.label', { id: run.narrative_id })}
        ref={trapRef}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      >
        <div className="m-rp-head">
          <div>
            <div className="m-rr-kicker">{t('research.replay.title')}</div>
            <div className="m-rp-run m-num">
              {runId} · {run.narrative_id}
            </div>
          </div>
          <button type="button" className="m-fchip" onClick={onClose}>
            {t('research.replay.close')}
          </button>
        </div>

        {/* Pinned for the whole replay: blueprint 3.4, and the protocol file's own demand. */}
        <p className="m-rp-disclosure" data-testid="replay-disclosure">
          {disclosure}
        </p>

        <div className="m-rp-body">
          {lines.slice(0, at.line + 1).map((line, index) => {
            if (line === undefined) return null;
            const typing = index === at.line;
            if (typing && at.chars === 0) return null;
            return (
              <div key={String(index)} className="m-rp-line" data-kind={line.kind}>
                {typing ? line.text.slice(0, at.chars) : line.text}
              </div>
            );
          })}

          {done && token !== null ? (
            <div className="m-rp-published" data-testid="replay-published">
              <div className="m-rp-pub-title">{t('research.replay.published')}</div>
              <div className="m-rp-token m-num">{t('research.replay.token', { token })}</div>
              {qr === null ? null : (
                <svg
                  className="m-rp-qr"
                  viewBox={`0 0 ${String(qr.size)} ${String(qr.size)}`}
                  role="img"
                  aria-label={t('research.replay.qr', { url })}
                >
                  <path d={qrPath(qr.data)} fill="currentColor" />
                </svg>
              )}
              <p className="m-rp-scan">{t('research.replay.scan')}</p>
              <p className="m-rp-url m-num">{url}</p>
            </div>
          ) : null}
          <div ref={tail} />
        </div>
      </div>
    </div>
  );
}
