import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type AuthBindings, isAppleConfigured, isAppleWebConfigured } from './server/auth';

const source = readFileSync(new URL('./server/auth.ts', import.meta.url), 'utf8');

describe('native Apple authentication configuration', () => {
  it('enables native verification from the bundle identifier alone', () => {
    expect(isAppleConfigured({} as AuthBindings)).toBe(false);
    expect(
      isAppleConfigured({
        APPLE_CLIENT_ID: 'service-id',
        APPLE_CLIENT_SECRET: 'secret',
      } as AuthBindings)
    ).toBe(false);
    expect(
      isAppleConfigured({
        APPLE_APP_BUNDLE_IDENTIFIER: 'com.significanthobbies.calorie',
      } as AuthBindings)
    ).toBe(true);
  });

  it('keeps browser Apple OAuth behind its separate signing credentials', () => {
    expect(
      isAppleWebConfigured({
        APPLE_APP_BUNDLE_IDENTIFIER: 'com.significanthobbies.calorie',
      } as AuthBindings)
    ).toBe(false);
    expect(
      isAppleWebConfigured({
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
