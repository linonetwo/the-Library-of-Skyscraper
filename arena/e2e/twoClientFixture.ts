import { test as base, expect, type BrowserContext } from '@playwright/test';

/** Both clients remain live for assertions; context/trace cleanup belongs to teardown. */
export const test = base.extend<{ pairedContexts: [BrowserContext, BrowserContext] }>({
  pairedContexts: async ({ browser }, use) => {
    const one = await browser.newContext();
    let two: BrowserContext | undefined;
    try {
      two = await browser.newContext();
      await use([one, two]);
    } finally {
      await Promise.all([one.close(), two?.close()]);
    }
  },
});
export { expect };
