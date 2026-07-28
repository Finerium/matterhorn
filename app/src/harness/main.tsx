/**
 * The dev-only screenshot harness: one grammar component per URL.
 *
 *   /harness.html?panel=<panel>&narrative=<id>&lang=<en|id>&theme=<light|dark>
 *
 * It exists so AC-GRAM-1..8 can be photographed one component at a time, before any surface
 * exists to put them on. Two rules it lives by:
 *
 *   The seed content root is read over the network at run time, never by a module specifier, so
 *   no fixture can enter the app import graph (blueprint 6.11 check 7, asserted by the
 *   quarantine spec). `__SEED_ROOT__` is a define supplied only in harness mode.
 *
 *   [data-testid="harness-panel"] mounts only once both reads have resolved, so a screenshot
 *   cannot photograph an empty frame and call it a panel.
 *
 * Harness mode is a vite mode, and this entry is reachable only through harness.html, which the
 * production build never takes as an input.
 */
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  ClaimMapPanel,
  DuelingPanel,
  IncidencePanel,
  Lang,
  MoneyFlowPanel,
  Narrative,
  OptionsPanel,
  Panel,
  ScaleCheckPanel,
  Source,
} from '../../../contracts/types';
import { makeCtx, type RenderCtx, type Theme } from '../renderers/ctx';
import ClaimMap from '../renderers/ClaimMap';
import ScaleCheck from '../renderers/ScaleCheck';
import MoneyFlow from '../renderers/MoneyFlow';
import Incidence from '../renderers/Incidence';
import Dueling from '../renderers/Dueling';
import Echo from '../renderers/Echo';
import Options from '../renderers/Options';
import Family from '../renderers/Family';
import Card from '../renderers/Card';
import Narration from '../renderers/Narration';
import '../tokens.css';
import '../renderers/renderers.css';
import './harness.css';

/** Injected by vite in harness mode; the entry is not built in any other mode. */
declare const __SEED_ROOT__: string;

/** Absent outside harness mode, which is a sentence rather than a stack trace. */
const SEED_ROOT: string | null = typeof __SEED_ROOT__ === 'string' ? __SEED_ROOT__ : null;
const NOT_HARNESS_MODE = 'The harness runs in harness mode only: pnpm exec vite app --mode harness';

const params = new URLSearchParams(window.location.search);
const panelKey = params.get('panel') ?? 'claim_map';
const narrativeId = params.get('narrative') ?? 'mbg-stop';
const lang: Lang = params.get('lang') === 'id' ? 'id' : 'en';
const theme: Theme = params.get('theme') === 'dark' ? 'dark' : 'light';

const read = async <T,>(path: string): Promise<T> => {
  if (SEED_ROOT === null) throw new Error(NOT_HARNESS_MODE);
  const response = await fetch(`${SEED_ROOT}/${path}`);
  if (!response.ok) throw new Error(`harness: ${path} responded ${String(response.status)}`);
  return (await response.json()) as T;
};

const panelOf = <T extends Panel>(narrative: Narrative, type: T['type']): T | undefined =>
  narrative.panels.find((p): p is T => p.type === type);

function Selected({ narrative, ctx }: { narrative: Narrative; ctx: RenderCtx }) {
  const [stopped, setStopped] = useState(false);
  const claimMap = panelOf<ClaimMapPanel>(narrative, 'claim_map');
  const scaleCheck = panelOf<ScaleCheckPanel>(narrative, 'scale_check');
  const moneyFlow = panelOf<MoneyFlowPanel>(narrative, 'money_flow');
  const incidence = panelOf<IncidencePanel>(narrative, 'incidence');
  const dueling = panelOf<DuelingPanel>(narrative, 'dueling');
  const options = panelOf<OptionsPanel>(narrative, 'options');

  switch (panelKey) {
    case 'claim_map':
      return claimMap === undefined ? null : <ClaimMap panel={claimMap} ctx={ctx} />;
    case 'scale_check':
      return scaleCheck === undefined ? null : <ScaleCheck panel={scaleCheck} ctx={ctx} />;
    case 'money_flow':
      return moneyFlow === undefined ? null : (
        <MoneyFlow
          panel={moneyFlow}
          ctx={ctx}
          stopped={stopped}
          onToggle={() => {
            setStopped(!stopped);
          }}
        />
      );
    case 'incidence':
      return incidence === undefined ? null : <Incidence panel={incidence} ctx={ctx} />;
    case 'dueling':
      return dueling === undefined ? null : <Dueling panel={dueling} ctx={ctx} />;
    case 'echo':
      return <Echo panel={narrative.echo} ctx={ctx} />;
    case 'echo_silence':
      return <Echo panel={null} ctx={ctx} />;
    case 'options':
      return options === undefined ? null : <Options panel={options} ctx={ctx} />;
    case 'family':
      return <Family narrative={narrative} ctx={ctx} />;
    case 'card_hero':
      return <Card narrative={narrative} variant="hero" ctx={ctx} />;
    case 'card_compact':
      return <Card narrative={narrative} variant="compact" ctx={ctx} />;
    case 'narration':
      return <Narration narrative={narrative} ctx={ctx} />;
    default:
      throw new Error(`harness: no component is registered for panel "${panelKey}"`);
  }
}

function Harness() {
  const [loaded, setLoaded] = useState<{ sources: Source[]; narrative: Narrative } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [sources, narrative] = await Promise.all([
          read<Source[]>('sources.json'),
          read<Narrative>(`narratives/${narrativeId}.json`),
        ]);
        setLoaded({ sources, narrative });
      } catch (error) {
        setFailure(error instanceof Error ? error.message : String(error));
      }
    })();
  }, []);

  if (failure !== null) return <div className="m-harness-fail">{failure}</div>;
  if (loaded === null) return null;

  const ctx = makeCtx(loaded.sources, lang, theme);
  return (
    <div data-testid="harness-panel" data-stagger="1" className="m-harness">
      <Selected narrative={loaded.narrative} ctx={ctx} />
    </div>
  );
}

document.body.dataset.mth = theme;
const container = document.getElementById('harness-root');
if (container === null) throw new Error('harness: #harness-root is missing from app/harness.html');
// No StrictMode: its development double-mount restarts the entrance animations mid-screenshot.
createRoot(container).render(<Harness />);
