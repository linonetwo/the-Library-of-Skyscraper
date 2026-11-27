# Browser acceptance

`ARENA_BROWSER_URL` selects the running UI; its existing proxy selects the authority.
Install dependencies through the normal project setup, then run `npm test` here.

The tactical normal-clock stories are opt-in for a fixed-package acceptance window:

```sh
ARENA_V070_ACCEPTANCE=1 ARENA_BROWSER_URL=http://127.0.0.1:5202 \
  npm test -- specs/tactical-solo.spec.ts specs/tactical-online.spec.ts
```

Run them serially against the package's actual worker/compiler. They create fresh
sessions and use visible UI commands at the ordinary 500ms clock. API calls only
observe state. Coverage is manual ink strike, paid repair, keyboard departure
reset, and two-owner contention/capture/retake/twenty-point victory. The fixture
closes both browser contexts. Screenshots use Playwright output paths; attached
JSON distinguishes authoritative event ticks from later snapshot observations.
No credentials or machine-specific dependency paths are written by these tests.

Without the opt-in flag these four tests are discovered and skipped. Discovery
can be checked without launching a browser: `npm test -- --list`.
