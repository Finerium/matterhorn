// @vitest-environment jsdom
/**
 * PROVES: AC-APP-23. The app-level error boundary catches a thrown render error and shows the
 * friendly fallback instead of a white screen.
 *
 * Post-install home: tests/unit/boundary.spec.tsx.
 *
 * The contract this file fixes, which is the whole of what the implementer has to build:
 *
 *   app/src/app/Boundary.tsx   default export, a component taking `children`.
 *                              Renders its children when nothing throws.
 *                              On a throw below it, renders [data-testid="error-fallback"].
 *                              The fallback says something a reader can act on, in the app's
 *                              own voice through the i18n bundle, and never shows the error
 *                              message or a stack.
 *
 * The module is imported dynamically off `process.cwd()` rather than by a relative specifier,
 * for two reasons. It survives the staging-to-tests move without a path edit, and a boundary
 * that does not exist yet fails one assertion by name rather than exploding at collection and
 * taking the file's other evidence with it.
 *
 * Two renderer refusals make this real rather than theoretical: `OrphanNumberError` and
 * `CardContractError` both throw during render by design (blueprint 6.2 and 6.5). A build
 * without a boundary turns either into a blank page, which is the failure mode this asserts
 * against. The second test throws a real `CardContractError` for exactly that reason.
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ComponentType, ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

/**
 * A stand-in for the real `CardContractError`, built by shape rather than imported, so this
 * file carries no relative path into app/src and survives the staging-to-tests move intact.
 * The boundary must not branch on the class anyway: it catches what throws.
 */
const cardContractError = (): Error =>
  Object.assign(
    new Error('CardContractError: narrative "x" carries no derived counts. Card chips render from derived counts only.'),
    { name: 'CardContractError' },
  );

const BOUNDARY_PATH = join(process.cwd(), 'app', 'src', 'app', 'Boundary.tsx');

let Boundary: ComponentType<{ children: ReactNode }> | null = null;
let importError = '';

beforeAll(async () => {
  try {
    const module = (await import(/* @vite-ignore */ pathToFileURL(BOUNDARY_PATH).href)) as {
      default: ComponentType<{ children: ReactNode }>;
    };
    Boundary = module.default;
  } catch (error) {
    importError = error instanceof Error ? error.message : String(error);
  }
});

/** The shape of a render-time failure: React unmounts the tree unless a boundary stops it. */
const Exploding = ({ error }: { error: Error }): ReactNode => {
  throw error;
};

/**
 * React logs a caught render error to console.error on its way to the boundary. That is React
 * working, not the app misbehaving, so it is silenced here rather than allowed to look like a
 * console-hygiene failure in the unit run.
 */
function renderCaught(child: ReactNode): void {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    if (Boundary === null) throw new Error('no boundary');
    render(<Boundary>{child}</Boundary>);
  } finally {
    quiet.mockRestore();
  }
}

describe('AC-APP-23 the app-level error boundary', () => {
  it('exists at app/src/app/Boundary.tsx with a default export', () => {
    expect(
      Boundary,
      `app/src/app/Boundary.tsx must default-export the app error boundary. Import failed: ${importError}`,
    ).not.toBeNull();
  });

  it('renders its children when nothing throws', () => {
    expect(Boundary).not.toBeNull();
    if (Boundary === null) return;
    render(
      <Boundary>
        <div data-testid="child">the app</div>
      </Boundary>,
    );
    expect(screen.getByTestId('child')).toBeTruthy();
    expect(screen.queryByTestId('error-fallback')).toBeNull();
  });

  it('catches a thrown render error and shows the friendly fallback', () => {
    expect(Boundary).not.toBeNull();
    if (Boundary === null) return;
    renderCaught(<Exploding error={new Error('render blew up')} />);

    const fallback = screen.queryByTestId('error-fallback');
    expect(fallback, 'a thrown render error must leave a fallback on screen, not a white page').not.toBeNull();
    expect(fallback?.textContent?.trim().length ?? 0, 'the fallback says something').toBeGreaterThan(0);
  });

  it('catches the renderer layer own refusals, which throw during render by design', () => {
    expect(Boundary).not.toBeNull();
    if (Boundary === null) return;
    renderCaught(<Exploding error={cardContractError()} />);
    expect(screen.queryByTestId('error-fallback')).not.toBeNull();
  });

  it('shows no error message, no stack, and no raw i18n key in the fallback', () => {
    expect(Boundary).not.toBeNull();
    if (Boundary === null) return;
    renderCaught(<Exploding error={new Error('SECRET_INTERNAL_DETAIL at line 42')} />);

    const text = screen.queryByTestId('error-fallback')?.textContent ?? '';
    expect(text).not.toContain('SECRET_INTERNAL_DETAIL');
    expect(text).not.toMatch(/\bat .+:\d+:\d+/);
    // The fallback speaks through the bundle, so a missing key would surface as itself.
    expect(text).not.toMatch(/\b(common|boundary|screen)\.[a-z][a-z0-9]*(\.[a-z0-9-]+)*\b/);
  });
});
