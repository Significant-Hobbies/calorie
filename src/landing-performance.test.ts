import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const marketing = new URL('../marketing/', import.meta.url);
const pages = readdirSync(marketing, { recursive: true })
  .filter((name) => name.endsWith('.html'))
  .map((name) => readFileSync(new URL(name, marketing), 'utf8'));
const sources = [
  readFileSync(new URL('../landing/src/pages/index.astro', import.meta.url), 'utf8'),
  ...pages,
];

describe('landing delivery', () => {
  for (const trigger of ['pointerdown', 'keydown', 'touchstart', 'scroll', 'timer']) {
    it(`queues Clarity immediately and loads once on ${trigger}`, () => {
      for (const source of sources) {
        const script = source.match(
          /<script[^>]*>(\(function\(\)\{const clarityProjectId[\s\S]*?)<\/script>/
        )?.[1];
        expect(script).toBeDefined();
        const listeners = new Map<string, () => void>();
        const insertBefore = vi.fn();
        const setTimeout = vi.fn();
        const clearTimeout = vi.fn();
        const window = {
          clarity: undefined as unknown as { (...args: string[]): void; q: string[][] },
          addEventListener: vi.fn((event: string, callback: () => void) => {
            listeners.set(event, callback);
          }),
          removeEventListener: vi.fn((event: string) => {
            listeners.delete(event);
          }),
        };
        runInNewContext(script ?? '', {
          window,
          document: {
            createElement: () => ({}),
            getElementsByTagName: () => [{ parentNode: { insertBefore } }],
          },
          setTimeout,
          clearTimeout,
        });
        expect(insertBefore).not.toHaveBeenCalled();
        expect(Array.from(window.clarity.q[0])).toEqual(['set', 'project_id', 'calorie']);
        window.clarity('set', 'test', 'queued');
        expect(window.clarity.q).toHaveLength(2);
        expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 90000);
        for (const call of window.addEventListener.mock.calls) {
          expect(call).toEqual([
            expect.any(String),
            expect.any(Function),
            { passive: true, once: true },
          ]);
        }
        const timeout = setTimeout.mock.calls[0][0];
        const callback = trigger === 'timer' ? timeout : listeners.get(trigger);
        callback();
        timeout();
        expect(insertBefore).toHaveBeenCalledTimes(1);
        expect(insertBefore.mock.calls[0][0]).toMatchObject({
          async: 1,
          src: 'https://www.clarity.ms/tag/y6bultfwvf',
        });
        expect(listeners.size).toBe(0);
        expect(clearTimeout).toHaveBeenCalledTimes(1);
      }
    });
  }
});
