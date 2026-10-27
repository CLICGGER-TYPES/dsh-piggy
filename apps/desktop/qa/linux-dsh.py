#!/usr/bin/env python3
"""Exact AppImage + installed npm plugin in a disposable Windows-free VM desktop.

Browser plugin not available in the host tool set. Playwright/CDP only reads DOM,
responses and screenshots; xdotool supplies all game/browser input. No state is
changed through evaluate/fetch, and no personal profile or API key is used.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import tarfile
import tempfile
import threading
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--repository', type=Path, required=True)
parser.add_argument('--host', type=Path, required=True)
args = parser.parse_args()
repo = args.repository.resolve()
out = repo / 'integrated-qa-results'
out.mkdir(exist_ok=True)
private = Path(tempfile.mkdtemp(prefix='piggy-integration-'))
home = private / 'dsh-home'
profile = private / 'desktop'
source = home / 'dsh-piggy'
cli = args.host / 'node_modules/@deepseek-ai/dsh/lib/bin.js'
image = repo / 'apps/desktop/dist/dsh-piggy-integrated-qa.AppImage'
tgz = next((repo / 'candidate-qa').glob('dsh-piggy-*.tgz'))
env = {**os.environ, 'DSH_HOME': str(home)}
children, checks, errors, responses = [], [], [], []
desktop = dsh = browser_proc = None
desktop_browser = web_browser = None
web_url = {'value': None}


def clean(text):
    return re.sub(r'(token=)[^&\s"<>]+', r'\1[redacted]', str(text))


def run(command, **kwargs):
    result = subprocess.run(command, capture_output=True, text=True, **kwargs)
    if result.returncode:
        raise RuntimeError(clean(f'{command[0]} failed: {result.stderr[-1500:]} {result.stdout[-1000:]}'))
    return result.stdout


def wait(check, label, seconds=40):
    end = time.monotonic() + seconds
    last = None
    while time.monotonic() < end:
        try:
            result = check()
            if result:
                return result
        except Exception as error:
            last = clean(error)
        time.sleep(.25)
    raise AssertionError(f'Timeout: {label}; {last}')


def launch(command, log, environment=env, web=False):
    proc = subprocess.Popen(command, cwd=repo, env=environment, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True, start_new_session=True)
    children.append(proc)

    def pump():
        with (out / log).open('a') as stream:
            for line in proc.stdout:
                if web and 'dsh web:' in line:
                    match = re.search(r'https?://\S+', line)
                    if match:
                        web_url['value'] = match[0]
                stream.write(clean(line))
                stream.flush()
    threading.Thread(target=pump, daemon=True).start()
    return proc


def record(name, **details):
    checks.append({'case': name, 'ok': True, **details})
    print('PASS:', name, flush=True)


def watch(page, label):
    page.on('pageerror', lambda error: errors.append({'surface': label, 'error': clean(error)}))


def shot(page, name):
    page.screenshot(path=str(out / (name + '.png')))
    # Capture actual X11 pixels of the content area, excluding the browser's
    # token-bearing address bar. This also exposes native clipping/occlusion.
    box = page.evaluate('''() => ({x:screenX+(outerWidth-innerWidth)/2,
        y:screenY+outerHeight-innerHeight,w:innerWidth,h:innerHeight})''')
    rect = ','.join(str(round(box[k])) for k in ['x', 'y', 'w', 'h'])
    run(['scrot', '-o', '-a', rect, str(out / (name + '-native.png'))])


def coord(page, selector):
    return page.locator(selector).first.evaluate('''e => {
      const r=e.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2;
      const hit=document.elementFromPoint(x,y);
      return {x:screenX+(outerWidth-innerWidth)/2+x,y:screenY+outerHeight-innerHeight+y,
        rect:[r.x,r.y,r.width,r.height],ok:!e.disabled&&r.width>0&&r.height>0&&
          x>=0&&y>=0&&x<innerWidth&&y<innerHeight&&(hit===e||e.contains(hit))};
    }''')


def click(page, selector, button=1):
    previous = None
    stable = 0

    def target():
        nonlocal previous, stable
        point = coord(page, selector)
        if not point['ok']:
            return False
        key = (round(point['x']), round(point['y']))
        stable = stable + 1 if key == previous else 0
        previous = key
        return point if stable >= 2 else False
    point = wait(target, 'visible stable native target ' + selector)
    run(['xdotool', 'mousemove', '--sync', str(round(point['x'])), str(round(point['y']))])
    time.sleep(.15)
    run(['xdotool', 'click', str(button)])
    time.sleep(.5)


def key(*keys):
    run(['xdotool', 'key', '--clearmodifiers', *keys])
    time.sleep(.6)


def scroll_to(page, selector):
    for _ in range(24):
        try:
            if coord(page, selector)['ok']:
                return
        except Exception:
            pass
        point = coord(page, '.dp-content')
        run(['xdotool', 'mousemove', str(round(point['x'])), str(round(point['y'])), 'click', '5'])
        time.sleep(.18)
    raise AssertionError('Cannot scroll native panel to ' + selector)


def has(page, selector):
    return page.locator(selector).count() > 0


def tappable(page, selector):
    try:
        return coord(page, selector)['ok']
    except Exception:
        return False


def home_tab(page, app):
    if has(page, '[data-home]'):
        click(page, '[data-home]')
    selector = f'[data-app="{app}"]'
    if not tappable(page, selector):
        dots = page.locator('[data-home-dot]').count()
        for index in range(dots):
            click(page, f'[data-home-dot="{index}"]')
            if tappable(page, selector):
                break
    click(page, selector)


def desktop_pages():
    return [page for context in desktop_browser.contexts for page in context.pages]


def desk_page(selector):
    def find():
        for page in desktop_pages():
            if tappable(page, selector):
                try:
                    if coord(page, selector)['ok']:
                        return page
                except Exception:
                    pass
        return None
    return wait(find, 'desktop page ' + selector)


def desktop_menu():
    page = desk_page('.dp-pig')
    if not any(has(p, '[data-home-dot]:visible') for p in desktop_pages()):
        click(page, '.dp-pig', 3)
    return desk_page('[data-home-dot]')


def stop_game():
    page = desktop_menu()
    home_tab(page, 'quit')
    wait(lambda: desktop.poll() is not None, 'graceful AppImage exit')


def start_game(mode):
    global desktop, desktop_browser
    desktop = launch([str(image), '--no-sandbox', '--disable-gpu', '--ozone-platform=x11',
                      '--remote-debugging-port=9412', '--window-mode=' + mode],
                     'appimage-' + mode + '.log', {**env, 'PIGGY_USERDATA': str(profile)})
    desktop_browser = wait(lambda: pw.chromium.connect_over_cdp('http://127.0.0.1:9412'), 'AppImage CDP')
    pet = desk_page('.dp-pig')
    for p in desktop_pages():
        watch(p, 'desktop-' + mode)
    wait(lambda: pet.locator('.dp-pig').get_attribute('data-stage') != 'box', 'fixture pig loaded')
    return pet


def start_dsh():
    global dsh
    web_url['value'] = None
    dsh = launch(['node', str(cli), 'web', '--no-open', '--port', '3088'], 'dsh.log', web=True)
    return wait(lambda: web_url['value'], 'real DSH web boot', 120)


def read_state(directory):
    return json.loads((directory / 'state.json').read_text())


try:
    run(['openbox', '--version'])
    launch(['openbox'], 'window-manager.log')
    launch(['picom', '--backend', 'xrender'], 'compositor.log')
    for directory, role in [(profile, 'desktop'), (source, 'source')]:
        run(['node', str(repo / 'apps/desktop/qa/seed-integration.mjs'), str(directory), role], cwd=repo)
    run(['node', str(cli), 'plugin', '--profile', 'web', 'add', str(tgz)], env=env, timeout=240)
    installed = home / 'profiles/web/node_modules/dsh-piggy'
    assert installed.exists() and installed.resolve().is_relative_to(home.resolve()), 'DSH must load the private installed tgz, not a worktree link'
    with tarfile.open(tgz) as archive:
        wanted = archive.extractfile('package/adapters/dsh/index.js').read()
    assert (installed / 'adapters/dsh/index.js').read_bytes() == wanted
    record('real npm package installation', adapterSha256=hashlib.sha256(wanted).hexdigest())
    image.chmod(0o755)
    with sync_playwright() as pw:
        pet = start_game('split')
        panel = desktop_menu()
        home_tab(panel, 'settings')
        scroll_to(panel, '[data-external-allow]')
        assert panel.locator('[data-external-allow]').get_attribute('aria-pressed') == 'false'
        click(panel, '[data-external-allow]')
        wait(lambda: (profile / 'work-endpoint/pair.json').exists(), 'native permission enables pair service')
        shot(panel, 'desktop-external-enabled')
        marker = json.loads((home / 'dsh-piggy/desktop-app.json').read_text())
        mounted = Path(os.readlink('/proc/' + str(marker['pid']) + '/exe')).parent / 'resources/game'
        assert mounted.is_dir(), 'Cannot inspect directly mounted AppImage game'
        with tarfile.open(tgz) as archive:
            members = {m.name: m for m in archive.getmembers() if m.isfile()}
            compared = 0
            for file in mounted.rglob('*'):
                if not file.is_file():
                    continue
                name = 'package/' + file.relative_to(mounted).as_posix()
                assert name in members, name + ' missing from npm package'
                assert file.read_bytes() == archive.extractfile(members[name]).read(), name + ' differs between AppImage and npm'
                compared += 1
        record('mounted AppImage game matches installed npm candidate', files=compared)
        record('direct AppImage split and native external permission', extracted=False)
        stop_game()
        pet = start_game('stage')
        assert read_state(profile)['name'] == '桌面猪'
        wait(lambda: (profile / 'work-endpoint/pair.json').exists(), 'permission survives stage restart')
        record('direct AppImage stage restart preserves permission and pig', extracted=False)
        if any(has(p, '[data-home-dot]:visible') for p in desktop_pages()):
            click(pet, '.dp-pig', 3)
        url = start_dsh()
        chrome = os.environ.get('CHROME_PATH', '/usr/bin/google-chrome')
        browser_proc = launch([chrome, '--no-sandbox', '--remote-debugging-port=9413',
                               '--user-data-dir=' + str(private / 'browser'), '--window-size=1180,850',
                               '--no-first-run', url], 'browser.log')
        web_browser = wait(lambda: pw.chromium.connect_over_cdp('http://127.0.0.1:9413'), 'DSH browser')
        page = wait(lambda: next((p for p in web_browser.contexts[0].pages if '3088' in p.url), None), 'DSH page')
        watch(page, 'DSH')
        page.on('response', lambda response: responses.append(response) if '/dsh-piggy/act' in response.url and response.request.method == 'POST' else None)
        wait(lambda: has(page, '.dp-pig:visible'), 'DSH plugin activation', 90)
        assert page.locator('[data-dsh-pig]').count() == 1
        click(page, '.dp-pig', 3)
        home_tab(page, 'bag')
        click(page, '[data-bag="food"]')
        click(page, '[data-use="apple"]')
        wait(lambda: responses and responses[-1].json().get('inventory', {}).get('apple') == 2, 'DSH native feeding')
        record('DSH activation and real feeding', applesAfter=2)
        for _ in range(16):
            click(page, '.dp-pig')
            if has(page, '.dp-reply:visible'):
                break
            time.sleep(.7)
        assert has(page, '.dp-reply:visible'), 'No reply offered; cannot claim reply coverage'
        before = page.locator('.dp-bubble').inner_text()
        click(page, '.dp-reply:visible')
        wait(lambda: page.locator('.dp-bubble').inner_text() != before, 'reply follow-up rendered')
        shot(page, 'dsh-reply')
        record('DSH native pet reply has a follow-up')
        key('ctrl+r')
        wait(lambda: has(page, '.dp-pig:visible'), 'DSH refresh')
        assert page.locator('[data-dsh-pig]').count() == 1
        record('DSH native refresh preserves single activation')
        click(page, '.dp-pig', 3)
        home_tab(page, 'settings')
        scroll_to(page, '[data-external-action="recheck"]')
        click(page, '[data-external-action="recheck"]')
        wait(lambda: has(page, '[data-external-action="connect"]:visible'), 'real desktop discovery')
        click(page, '[data-external-action="connect"]')
        click(page, '[data-external-action="choose-next"]')
        wait(lambda: has(page, '[data-link="connected"]'), 'native DSH connection')
        time.sleep(1)
        frozen = hashlib.sha256((source / 'state.json').read_bytes()).hexdigest()
        home_tab(page, 'bag')
        click(page, '[data-bag="food"]')
        click(page, '[data-use="apple"]')
        wait(lambda: responses[-1].json().get('inventory', {}).get('apple') == 4, 'feeding targets desktop')
        assert hashlib.sha256((source / 'state.json').read_bytes()).hexdigest() == frozen
        shot(page, 'dsh-external-care')
        record('DSH native connection forwards care exclusively to desktop', desktopApples=4, sourceUnchanged=True)
        stop_game()
        wait(lambda: has(page, '[data-external-offline="true"]'), 'desktop offline indication', 40)
        assert hashlib.sha256((source / 'state.json').read_bytes()).hexdigest() == frozen
        record('desktop offline keeps embedded state frozen')
        dsh.terminate()
        dsh.wait(timeout=30)
        url = start_dsh()
        # Navigation is native keyboard input, not DOM mutation.
        key('ctrl+l')
        run(['xdotool', 'type', '--clearmodifiers', '--delay', '1', url])
        key('Return')
        wait(lambda: has(page, '[data-external-offline="true"]'), 'DSH restart keeps external offline mode', 90)
        assert hashlib.sha256((source / 'state.json').read_bytes()).hexdigest() == frozen
        record('real DSH host restart preserves external mode and paused source')
        click(page, '.dp-pig', 3)
        home_tab(page, 'settings')
        scroll_to(page, '[data-external-action="withdraw"]')
        click(page, '[data-external-action="withdraw"]')
        click(page, '[data-external-action="withdraw-go"]')
        wait(lambda: page.locator('[data-dsh-pig]').get_attribute('data-link') is None and has(page, '.dp-pig:visible'), 'withdraw restores embedded pig')
        shot(page, 'dsh-withdraw-offline')
        record('native offline withdrawal restores embedded pig')
        assert not errors, errors
        record('page error check', errors=0)
        (out / 'report.json').write_text(json.dumps({'ok': True, 'cases': checks, 'errors': errors,
            'input': 'native XTest mouse/keyboard', 'browser': 'Playwright read-only CDP; Browser plugin not available',
            'appImageSha256': hashlib.sha256(image.read_bytes()).hexdigest(),
            'npmSha256': hashlib.sha256(tgz.read_bytes()).hexdigest(),
            'linuxDisplay': 'Xvfb/Openbox/picom software rendering; --no-sandbox --disable-gpu --ozone-platform=x11'}, ensure_ascii=False, indent=2))
except Exception as error:
    (out / 'report.json').write_text(json.dumps({'ok': False, 'error': clean(error), 'cases': checks, 'errors': errors}, ensure_ascii=False, indent=2))
    for name in ['piggy.log', 'stage.log', 'window.json']:
        if (profile / name).exists():
            (out / ('desktop-' + name)).write_text(clean((profile / name).read_text()))
    if desktop_browser:
        for index, page in enumerate(desktop_pages()):
            try:
                shot(page, 'failure-desktop-' + str(index))
                details = page.evaluate('''() => ({url:location.href,body:document.body?.innerText,
                    pig:document.querySelector('.dp-pig')?.outerHTML,html:document.documentElement.outerHTML.slice(-2000)})''')
                (out / ('failure-desktop-' + str(index) + '.json')).write_text(clean(json.dumps(details, ensure_ascii=False)))
            except Exception:
                pass
    if web_browser:
        for index, page in enumerate(web_browser.contexts[0].pages):
            try:
                shot(page, 'failure-web-' + str(index))
                (out / ('failure-web-' + str(index) + '.txt')).write_text(clean(page.locator('body').inner_text()))
            except Exception:
                pass
    raise
finally:
    for proc in reversed(children):
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=15)
            except subprocess.TimeoutExpired:
                proc.kill()
