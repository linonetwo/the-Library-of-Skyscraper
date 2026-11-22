#!/usr/bin/env python3
"""Select existing Arena checks from a NUL-delimited diff; unknown code is full."""
import json
import os
import subprocess
from pathlib import Path

DOMAINS = ('core', 'map_lib', 'build', 'art', 'tools_unit', 'http', 'mcp_browser',
           'e2e_full', 'e2e_assets', 'e2e_map')


def classify(paths, full=False):
    selected = set(DOMAINS) if full else set()
    for path in paths:
        if path.startswith('.github/workflows/') or path == '.github/scripts/arena-scope.py':
            selected.update(DOMAINS)
        elif not path.startswith('arena/'):
            continue
        elif path.endswith(('.md', '.mdx')) or path.startswith('arena/docs/'):
            continue
        elif path.startswith('arena/art/'):
            selected.add('art')
        elif path.startswith('arena/client/public/assets/'):
            selected.update(('art', 'build', 'e2e_assets'))
        elif path == 'arena/shared/world-map.json':
            selected.update(('map_lib', 'build', 'e2e_map'))
        elif path.startswith('arena/shared/'):
            selected.update(DOMAINS)
        elif path.startswith(('arena/server/', 'arena/script-sdk/', 'arena/script-toolchain/', 'arena/script-runner/')):
            selected.update(('core', 'build', 'tools_unit', 'http', 'mcp_browser', 'e2e_full'))
        elif path.startswith('arena/client/src/'):
            selected.update(('build', 'mcp_browser', 'e2e_full'))
        elif path.startswith(('arena/tools/', 'arena/tests/')):
            selected.update(('tools_unit', 'http', 'mcp_browser', 'build'))
        elif path.startswith('arena/e2e/'):
            selected.update(('build', 'e2e_full'))
        else:
            selected.update(DOMAINS)
    flags = {name: name in selected for name in DOMAINS}
    flags['e2e'] = any(flags[name] for name in ('e2e_full', 'e2e_assets', 'e2e_map'))
    flags['browser'] = flags['e2e'] or flags['mcp_browser']
    flags['runtime'] = flags['core'] or flags['http'] or flags['browser']
    flags['tools'] = flags['tools_unit'] or flags['http'] or flags['browser']
    flags['rust'] = flags['core'] or flags['map_lib'] or flags['runtime']
    flags['node'] = flags['build'] or flags['art'] or flags['tools'] or flags['runtime']
    return flags


def changed_paths(base, head, pull_request=False):
    # Disabling rename detection includes BOTH endpoints, also for moves out of code.
    raw = subprocess.check_output(['git', 'diff', '--no-renames', '--name-only', '-z', *([f'{base}...{head}'] if pull_request else [base, head]), '--'])
    return raw.decode('utf-8', 'surrogateescape').split('\0')[:-1]


def main():
    event = os.environ.get('GITHUB_EVENT_NAME', '')
    ref = os.environ.get('GITHUB_REF', '')
    event_file = os.environ.get('GITHUB_EVENT_PATH')
    payload = json.loads(Path(event_file).read_text()) if event_file else {}
    pr = payload.get('pull_request', {})
    full = event == 'workflow_dispatch' or ref.startswith('refs/tags/')
    full |= any('integration' in value for value in (
        os.environ.get('GITHUB_HEAD_REF', ''), os.environ.get('GITHUB_BASE_REF', ''), ref))
    base = pr.get('base', {}).get('sha') or payload.get('before')
    head = pr.get('head', {}).get('sha') or os.environ.get('GITHUB_SHA')
    paths = []
    if not full:
        try:
            if not base or not head or set(base) == {'0'}:
                raise ValueError('No diff base')
            paths = changed_paths(base, head, bool(pr))
            if not paths:
                raise ValueError('Empty comparison')
        except (subprocess.CalledProcessError, ValueError):
            full = True
    flags = classify(paths, full)
    output = '\n'.join(f'{key}={str(value).lower()}' for key, value in flags.items()) + '\n'
    print(output, end='')
    if target := os.environ.get('GITHUB_OUTPUT'):
        with open(target, 'a') as stream:
            stream.write(output)
    if summary := os.environ.get('GITHUB_STEP_SUMMARY'):
        names = ', '.join(name for name in DOMAINS if flags[name]) or 'documentation only (no toolchains)'
        with open(summary, 'a') as stream:
            stream.write(f'### Arena check scope\n\n{names}\n')


if __name__ == '__main__':
    main()
