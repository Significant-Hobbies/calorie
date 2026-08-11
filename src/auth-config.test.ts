import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type AuthBindings, isAppleConfigured } from './server/auth';

const source = readFileSync(new URL('./server/auth.ts', import.meta.url), 'utf8');

describe('native Apple authentication configuration', () => {
  it('requires every Apple server value without reading credentials eagerly', () => {
    expect(isAppleConfigured({} as AuthBindings)).toBe(false);
    expect(
      isAppleConfigured({
        APPLE_CLIENT_ID: 'service-id',
        APPLE_CLIENT_SECRET: 'secret',
      } as AuthBindings)
    ).toBe(false);
    expect(
      isAppleConfigured({
        APPLE_CLIENT_ID: 'service-id',
        APPLE_CLIENT_SECRET: 'secret',
        APPLE_APP_BUNDLE_IDENTIFIER: 'com.significanthobbies.calorie',
      } as AuthBindings)
    ).toBe(true);
  });

  it('uses bearer sessions and forbids implicit email linking', () => {
    expect(source).toContain('plugins: [bearer()]');
    expect(source).toContain('disableImplicitLinking: true');
    expect(source).toContain("trustedProviders: ['google', 'apple']");
    expect(source).toContain("'calorie://auth'");
  });
});
