/**
 * The full interactive constellation: every published node, every link, pan and zoom.
 *
 * This is the one component in the app with a frame budget written into an acceptance criterion
 * (AC-PERF-4: a 500-node graph, ten seconds of scripted pan and zoom, no task over 200 ms, heap
 * under 250 MB), so the shape of it is decided by that and not by taste.
 *
 *   1. A gesture never enters React. Pan and zoom live in a closure and write one `transform`
 *      attribute on one `<g>`, coalesced into a single `requestAnimationFrame` callback. No
 *      `setState` runs while a pointer is down, so no reconciliation happens at 60 Hz.
 *   2. The nodes and links are one memo keyed on the graph and the filter scope. Selecting a node
 *      does not touch it: selection draws as two extra elements on top (a ring and the selected
 *      node's own edges), the same trick the Archive teaser uses, so a click re-renders three
 *      elements rather than a thousand.
 *   3. No listener per node. Four handlers on the container serve every node: the press records
 *      the `data-node` under it and the release decides whether that was a tap or a pan, so the
 *      memo never has to be invalidated to rebind a handler.
 *   4. One layout read per animation frame at most: the container rect is cached and the cache is
 *      dropped by the same callback that writes the transform, so a wheel burst cannot force a
 *      synchronous layout per event.
 *
 * Accessibility: the nodes are deliberately not 500 tab stops. The graph is one focusable group
 * that pans and zooms from the keyboard, with real buttons for zoom and reset, and the archive
 * table beside it carries every node as a row that selects the same narrative. The picture is the
 * fast path; the table is the complete one.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import type { Constellation as Graph } from '../../../contracts/types';
import { layout, VIEW } from './graph';

const ZOOM = { min: 0.6, max: 14 } as const;

/** Labels stop being readable long before they stop being cheap. Past this, the rail names it. */
const LABEL_LIMIT = 40;


interface Camera {
  pan(dx: number, dy: number): void;
  zoomAt(factor: number, clientX: number, clientY: number): void;
  zoom(factor: number): void;
  reset(): void;
  stop(): void;
  perPx(): number;
}

function makeCamera(box: RefObject<HTMLDivElement | null>, cam: RefObject<SVGGElement | null>): Camera {
  const at = { x: 0, y: 0, k: 1 };
  let frame = 0;
  let rect: DOMRect | null = null;

  const apply = () => {
    frame = 0;
    rect = null;
    cam.current?.setAttribute('transform', `translate(${at.x.toFixed(3)} ${at.y.toFixed(3)}) scale(${at.k.toFixed(4)})`);
  };
  const schedule = () => {
    if (frame === 0) frame = requestAnimationFrame(apply);
  };
  const measure = (): DOMRect => (rect ??= box.current?.getBoundingClientRect() ?? new DOMRect(0, 0, VIEW.w, VIEW.h));

  return {
    perPx: () => VIEW.w / Math.max(measure().width, 1),
    pan(dx, dy) {
      at.x += dx;
      at.y += dy;
      schedule();
    },
    zoomAt(factor, clientX, clientY) {
      const area = measure();
      const px = (clientX - area.left) * (VIEW.w / Math.max(area.width, 1));
      const py = (clientY - area.top) * (VIEW.h / Math.max(area.height, 1));
      const k = Math.min(ZOOM.max, Math.max(ZOOM.min, at.k * factor));
      // The user-space point under the cursor stays under the cursor: p = x + k * u.
      at.x = px - ((px - at.x) / at.k) * k;
      at.y = py - ((py - at.y) / at.k) * k;
      at.k = k;
      schedule();
    },
    zoom(factor) {
      const area = measure();
      this.zoomAt(factor, area.left + area.width / 2, area.top + area.height / 2);
    },
    reset() {
      at.x = 0;
      at.y = 0;
      at.k = 1;
      schedule();
    },
    stop() {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}

export interface ConstellationProps {
  graph: Graph;
  /** Nodes the filters keep. The rest are drawn dim: a filter hides no published link. */
  inScope: Set<string>;
  selected: string | null;
  onSelect: (nodeId: string) => void;
  label: string;
  zoomIn: string;
  zoomOut: string;
  reset: string;
  lang: 'en' | 'id';
}

export default function Constellation({
  graph,
  inScope,
  selected,
  onSelect,
  label,
  zoomIn,
  zoomOut,
  reset,
  lang,
}: ConstellationProps) {
  const box = useRef<HTMLDivElement>(null);
  const cam = useRef<SVGGElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; moved: number; node: string | null } | null>(null);
  const [camera] = useState(() => makeCamera(box, cam));

  const places = useMemo(() => layout(graph), [graph]);
  const radius = graph.nodes.length > 120 ? 0.75 : 1.5;

  // Wheel has to be a native non-passive listener: React registers `wheel` passively at the root,
  // where preventDefault does nothing and the page scrolls out from under the zoom.
  useEffect(() => {
    const el = box.current;
    if (el === null) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const lines = event.deltaMode === 1 ? 16 : 1;
      camera.zoomAt(Math.exp(-event.deltaY * lines * 0.0016), event.clientX, event.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      camera.stop();
    };
  }, [camera]);

  useEffect(() => {
    camera.reset();
  }, [camera, graph]);

  const drawn = useMemo(() => {
    const dim = (id: string) => (inScope.has(id) ? '1' : '0');
    // Ten headlines drawn at once are a pile, not a picture: a published headline is forty to
    // sixty characters and the dots are twenty units apart. So the dot wears its permalink slug,
    // which is short, unique, and the same string the table row and the export column carry, and
    // the headline is the node's `<title>`: its accessible name, its tooltip, and still text on
    // the page. Past LABEL_LIMIT nodes neither is drawn and the rail is where a node is named.
    const labelled = graph.nodes.length <= LABEL_LIMIT;
    return (
      <>
        <g className="m-rc-links">
          {graph.links.map((link) => {
            const from = places.get(link.a);
            const to = places.get(link.b);
            if (from === undefined || to === undefined) return null;
            return (
              <line
                key={`${link.a}|${link.b}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                data-on={inScope.has(link.a) && inScope.has(link.b) ? '1' : '0'}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>
        <g className="m-rc-nodes">
          {graph.nodes.map((node) => {
            const at = places.get(node.id);
            if (at === undefined) return null;
            return (
              <circle key={node.id} cx={at.x} cy={at.y} r={radius} data-node={node.id} data-on={dim(node.id)}>
                {labelled ? <title>{lang === 'id' ? node.label.id : node.label.en}</title> : null}
              </circle>
            );
          })}
        </g>
        {!labelled ? null : (
          <g className="m-rc-labels" aria-hidden="true">
            {graph.nodes.map((node) => {
              const at = places.get(node.id);
              if (at === undefined) return null;
              const away = radius + 1.4;
              return (
                <text
                  key={node.id}
                  x={at.x + (at.side === 'end' ? -away : at.side === 'start' ? away : 0)}
                  y={at.y + (at.side === 'middle' ? away + 2 : 0.75)}
                  textAnchor={at.side}
                  data-on={dim(node.id)}
                >
                  {node.narrative_id}
                </text>
              );
            })}
          </g>
        )}
      </>
    );
  }, [graph, places, inScope, radius, lang]);

  const here = selected === null ? undefined : places.get(selected);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // The node under the press is read HERE and not from the later click, because pointer capture
    // retargets the compatibility mouse events to the capturing element: by click time the target
    // is this box and every node id is gone. Reading it at press time also puts the tap and the
    // drag in one place, which is where the "was this a drag" question already lives.
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: 0,
      node: (event.target as Element | null)?.getAttribute('data-node') ?? null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    if (held === null || held.id !== event.pointerId) return;
    const scale = camera.perPx();
    const dx = event.clientX - held.x;
    const dy = event.clientY - held.y;
    held.x = event.clientX;
    held.y = event.clientY;
    held.moved += Math.abs(dx) + Math.abs(dy);
    camera.pan(dx * scale, dy * scale);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    if (held === null || held.id !== event.pointerId) return;
    drag.current = null;
    // A press that travelled is a pan and selects nothing; a press that stayed put is a tap.
    if (held.moved <= 4 && held.node !== null) onSelect(held.node);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = 8;
    const moves: Record<string, () => void> = {
      ArrowLeft: () => {
        camera.pan(step, 0);
      },
      ArrowRight: () => {
        camera.pan(-step, 0);
      },
      ArrowUp: () => {
        camera.pan(0, step);
      },
      ArrowDown: () => {
        camera.pan(0, -step);
      },
      '+': () => {
        camera.zoom(1.25);
      },
      '=': () => {
        camera.zoom(1.25);
      },
      '-': () => {
        camera.zoom(0.8);
      },
      '0': () => {
        camera.reset();
      },
    };
    const move = moves[event.key];
    if (move === undefined) return;
    event.preventDefault();
    move();
  };

  return (
    <div className="m-rc">
      <div
        className="m-rc-box"
        ref={box}
        tabIndex={0}
        role="group"
        aria-label={label}
        data-testid="research-constellation"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <svg className="m-rc-svg" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden="true">
          {/* Delegated: one click handler for every node, so the memo below never rebinds one. */}
          <g ref={cam}>
            {drawn}
            {here === undefined ? null : (
              <>
                <g className="m-rc-sel-links">
                  {graph.links
                    .filter((link) => link.a === selected || link.b === selected)
                    .map((link) => {
                      const from = places.get(link.a);
                      const to = places.get(link.b);
                      if (from === undefined || to === undefined) return null;
                      return (
                        <line
                          key={`${link.a}|${link.b}`}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    })}
                </g>
                <circle
                  className="m-rc-ring"
                  cx={here.x}
                  cy={here.y}
                  r={radius + 2}
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
          </g>
        </svg>
      </div>
      <div className="m-rc-tools">
        <button type="button" className="m-rc-tool" onClick={() => { camera.zoom(0.8); }} aria-label={zoomOut}>
          -
        </button>
        <button type="button" className="m-rc-tool" onClick={() => { camera.zoom(1.25); }} aria-label={zoomIn}>
          +
        </button>
        <button type="button" className="m-rc-tool m-rc-tool-w" onClick={() => { camera.reset(); }}>
          {reset}
        </button>
      </div>
    </div>
  );
}
