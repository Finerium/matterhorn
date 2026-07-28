/**
 * The narration binding: the sentences a narrative says, each one tied to the graph elements it
 * is about.
 *
 * Blueprint 6.3 stores narration per language with an `els` array per sentence, and the zip
 * paints the tapped sentence with the tint and highlights its elements with `data-hl`. Selecting
 * a sentence here reports its `els` upward; the surface that owns both columns applies the
 * highlight, which is the Gate 3 shell. Uncontrolled when no `onSelect` is passed, so the
 * component is useful on its own.
 */
import { useState } from 'react';
import type { Narrative } from '../../../contracts/types';
import type { RenderCtx } from './ctx';

interface NarrationProps {
  narrative: Narrative;
  ctx: RenderCtx;
  /** Controlled selection. Omit to let the component hold its own. */
  activeId?: string | null;
  onSelect?: (sentenceId: string, els: string[]) => void;
}

export default function Narration({ narrative, ctx, activeId, onSelect }: NarrationProps) {
  const [own, setOwn] = useState<string | null>(null);
  const active = activeId === undefined ? own : activeId;
  const sentences = narrative.narration[ctx.lang].sentences;

  return (
    <div className="m-voice">
      {sentences.map((sentence) => {
        const select = () => {
          setOwn(sentence.id === active ? null : sentence.id);
          onSelect?.(sentence.id, sentence.els);
        };
        return (
          <span key={sentence.id}>
            <span
              className="m-sent"
              data-sent={sentence.id === active ? 'on' : 'off'}
              data-els={sentence.els.join(' ')}
              role="button"
              tabIndex={0}
              onClick={select}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                select();
              }}
            >
              {sentence.text}
            </span>{' '}
          </span>
        );
      })}
    </div>
  );
}
