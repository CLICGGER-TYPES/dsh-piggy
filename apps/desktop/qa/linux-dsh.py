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
profile = private / 'xdg-data/piggy'
legacy = private / 'xdg-config/dsh-piggy-desktop'
source = home / 'dsh-piggy'
cli = args.host / 'node_modules/@deepseek-ai/dsh/lib/bin.js'
image = repo / 'apps/desktop/dist/dsh-piggy-integrated-qa.AppImage'
tgz = next((repo / 'candidate-qa').glob('dsh-piggy-*.tgz'))
env = {**os.environ, 'DSH_HOME': str(home), 'XDG_DATA_HOME': str(private / 'xdg-data'), 'XDG_CONFIG_HOME': str(private / 'xdg-config')}
children, checks, errors, responses = [], [], [], []
state_responses, act_responses = [], []
body_cache = {}
tracked_pages = set()
desktop = dsh = browser_proc = None
desktop_browser = web_browser = None
web_url = {'value': None}
cdp_readers = {}
# Extra isolated profiles are seeded before their own desktop instance starts:
# natural growth and an already-ripe helper farm. They never share the legacy/default profile.
natural_profile = private / 'farm-natural/piggy'
ripe_profile = private / 'farm-ripe/piggy'
HOUR_MS = 3600000


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
    save_diagnostics()
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


def save_diagnostics():
    for label, browser in [('desktop', desktop_browser), ('web', web_browser)]:
        if browser is None:
            continue
        try:
            pages = browser_pages(browser)
        except Exception:
            continue
        for index, page in enumerate(pages):
            try:
                details = page.evaluate("""() => {
                  const p=document.querySelector('.dp-pig'),r=p?.getBoundingClientRect();
                  const hit=r?document.elementFromPoint(r.x+r.width/2,r.y+r.height/2):null;
                  return {body:document.body?.innerText,role:window.piggyShell?.role,
                    viewport:{screenX,screenY,outerWidth,outerHeight,innerWidth,innerHeight},
                    scrolls:[...document.querySelectorAll('[data-scroll-key]')].map(e=>({key:e.getAttribute('data-scroll-key'),top:e.scrollTop,h:e.clientHeight,total:e.scrollHeight})),
                    pig:r?{x:r.x,y:r.y,w:r.width,h:r.height,stage:p.getAttribute('data-stage'),hit:hit?.className}:null};
                }""")
                (out / f'failure-{label}-{index}.json').write_text(clean(json.dumps(details, ensure_ascii=False)))
                shot(page, f'failure-{label}-{index}')
            except Exception as error:
                (out / f'failure-{label}-{index}-capture.txt').write_text(clean(error))


def record(name, **details):
    checks.append({'case': name, 'ok': True, **details})
    print('PASS:', name, flush=True)


def watch(page, label):
    page.on('pageerror', lambda error: errors.append({'surface': label, 'error': clean(error)}))


def track(page, label):
    """Attach read-only page/error and response observers exactly once per page."""
    key = id(page)
    if key in tracked_pages:
        return
    tracked_pages.add(key)
    watch(page, label)
    page.on('response', lambda response: state_responses.append({'surface': label, 'response': response})
            if response.url.split('?', 1)[0].endswith('/dsh-piggy/state') and response.request.method == 'GET' else None)
    page.on('response', lambda response: act_responses.append({'surface': label, 'response': response})
            if '/dsh-piggy/act' in response.url and response.request.method == 'POST' else None)


def shot(page, name):
    page.screenshot(path=str(out / (name + '.png')))
    # Capture actual X11 pixels of the content area, excluding the browser's
    # token-bearing address bar. This also exposes native clipping/occlusion.
    # Openbox adds a bottom border: subtract the horizontal frame half-width
    # from outerHeight-innerHeight, otherwise 9px home dots are missed by 4px.
    box = page.evaluate('''() => ({x:screenX+(outerWidth-innerWidth)/2,
        y:screenY+outerHeight-innerHeight-(outerWidth-innerWidth)/2,w:innerWidth,h:innerHeight})''')
    rect = ','.join(str(round(box[k])) for k in ['x', 'y', 'w', 'h'])
    run(['scrot', '-o', '-a', rect, str(out / (name + '-native.png'))])


def coord(page, selector):
    return page.locator(selector).first.evaluate('''e => {
      const r=e.getBoundingClientRect();
      const fx=e.matches('.dp-pig')?(e.getAttribute('data-walk')==='right'?.33:.67):.5;
      const x=r.x+r.width*fx, y=r.y+r.height/2;
      const hit=document.elementFromPoint(x,y);
      return {x:screenX+(outerWidth-innerWidth)/2+x,y:screenY+outerHeight-innerHeight-(outerWidth-innerWidth)/2+y,
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
        stable = stable + 1 if previous and abs(key[0]-previous[0]) <= 2 and abs(key[1]-previous[1]) <= 2 else 0
        previous = key
        return point if selector == '.dp-pig' or stable >= 2 else False
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
        point = page.locator(selector).first.evaluate('''e => {
          let p=e.parentElement;
          while(p){const c=getComputedStyle(p);if(/auto|scroll/.test(c.overflowY)&&p.scrollHeight>p.clientHeight)break;p=p.parentElement}
          const r=(p||document.querySelector('.dp-content')).getBoundingClientRect();
          const er=e.getBoundingClientRect();
          return {x:screenX+(outerWidth-innerWidth)/2+r.x+r.width/2,y:screenY+outerHeight-innerHeight-(outerWidth-innerWidth)/2+r.y+r.height/2,
            scrollTop:p?.scrollTop,scrollHeight:p?.scrollHeight,clientHeight:p?.clientHeight,
            scrollKey:p?.getAttribute('data-scroll-key'),target:{y:er.y,h:er.height,disabled:e.disabled},
            container:{y:r.y,h:r.height},hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.className};
        }''')
        with (out / 'native-scroll-trace.jsonl').open('a') as trace:
            trace.write(json.dumps({'selector':selector,'at':time.time(),**point},ensure_ascii=False)+'\n')
        target_middle = point['target']['y'] + point['target']['h'] / 2
        container_middle = point['container']['y'] + point['container']['h'] / 2
        run(['xdotool', 'mousemove', str(round(point['x'])), str(round(point['y'])), 'click', '4' if target_middle < container_middle else '5'])
        time.sleep(.18)
    save_diagnostics()
    raise AssertionError('Cannot scroll native panel to ' + selector)


def has(page, selector):
    return page.locator(selector).count() > 0


def tappable(page, selector):
    try:
        return coord(page, selector)['ok']
    except Exception:
        return False


def open_web_menu(page):
    if page.locator('[data-dsh-pig]').get_attribute('data-open') != 'true':
        click(page, '.dp-pig', 3)
    wait(lambda: page.locator('[data-dsh-pig]').get_attribute('data-open') == 'true', 'web panel opened')


def home_tab(page, app):
    # After a host restart there is no cached desktop snapshot; the approved
    # offline view offers its own settings entry instead of home app tiles.
    if app == 'settings' and tappable(page, '[data-external-open-settings]'):
        click(page, '[data-external-open-settings]')
        return
    if has(page, '[data-home]'):
        click(page, '[data-home]')
    selector = f'[data-app="{app}"]'
    wait(lambda: has(page, selector), 'home app registered ' + app)
    if not tappable(page, selector):
        index = page.locator(selector).first.evaluate('e=>e.closest("[data-home-page]").getAttribute("data-home-page")')
        click(page, f'[data-home-dot="{index}"]')
        wait(lambda: tappable(page, selector), 'native home page exposes ' + app)
    click(page, selector)


def browser_pages(browser):
    # A pure Python sleep does not dispatch Playwright's sync event loop. Pump
    # an explicitly read-only protocol request while waiting for new windows.
    reader = cdp_readers.get(browser)
    if reader is None:
        reader = browser.new_browser_cdp_session()
        cdp_readers[browser] = reader
    reader.send('Target.getTargets')
    return [page for context in browser.contexts for page in context.pages]


def desktop_pages():
    return browser_pages(desktop_browser)


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
    if not any(has(p, '[data-home-dot]:visible, [data-home]:visible') for p in desktop_pages()):
        click(page, '.dp-pig', 3)
    return desk_page('.dp-content')


def stop_game():
    page = desktop_menu()
    home_tab(page, 'quit')
    wait(lambda: desktop.poll() is not None, 'graceful AppImage exit')


def start_game(mode, use_default=False, data_profile=None, port=9412, label=None):
    global desktop, desktop_browser
    game_env = {**env, 'PIGGY_USERDATA': str(data_profile or profile)}
    if use_default:
        game_env.pop('PIGGY_USERDATA', None)
    desktop = launch([str(image), '--no-sandbox', '--disable-gpu', '--ozone-platform=x11',
                      '--remote-debugging-port=' + str(port), '--window-mode=' + mode],
                     'appimage-' + mode + '.log', game_env)
    desktop_browser = wait(lambda: pw.chromium.connect_over_cdp('http://127.0.0.1:' + str(port)), 'AppImage CDP')
    pet = desk_page('.dp-pig')
    for p in desktop_pages():
        track(p, label or 'desktop-' + mode)
    wait(lambda: pet.locator('.dp-pig').get_attribute('data-stage') != 'box', 'fixture pig loaded')
    return pet


def start_dsh():
    global dsh
    web_url['value'] = None
    dsh = launch(['node', str(cli), 'web', '--no-open', '--port', '3088'], 'dsh.log', web=True)
    return wait(lambda: web_url['value'], 'real DSH web boot', 120)


def read_state(directory):
    return json.loads((directory / 'state.json').read_text())


def post_json(response):
    try:
        return response.request.post_data_json or {}
    except Exception:
        return {}


def item_body(item):
    key = id(item['response'])
    if key not in body_cache:
        try:
            body_cache[key] = item['response'].json()
        except Exception:
            body_cache[key] = None
    return body_cache[key]


def farm_views(surface):
    # Dispatch Playwright's sync event loop through a read-only protocol query;
    # time.sleep alone does not deliver new HTTP response events.
    for browser in [web_browser, desktop_browser]:
        if browser is not None:
            try:
                browser_pages(browser)
            except Exception:
                pass
    views = []
    for item in state_responses:
        if item['surface'] != surface:
            continue
        body = item_body(item)
        if not isinstance(body, dict):
            continue
        view = (body.get('extViews') or {}).get('farm')
        if isinstance(view, dict) and isinstance(view.get('plots'), list) and len(view['plots']) >= 6:
            views.append(view)
    return views


def poll(check, seconds):
    """Non-fatal bounded polling for optional read-only evidence."""
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        try:
            result = check()
            if result:
                return result
        except Exception:
            pass
        time.sleep(.25)
    return None


def snapshot_pair(surface, required=True, seconds=20):
    count = len(farm_views(surface))
    first = poll(lambda: (farm_views(surface)[count] if len(farm_views(surface)) > count else None), seconds)
    if first is None:
        if required:
            save_diagnostics()
            raise AssertionError('Timeout: fresh farm snapshot for ' + surface)
        return None, None
    count = len(farm_views(surface))
    second = poll(lambda: (farm_views(surface)[count] if len(farm_views(surface)) > count else None), seconds)
    if second is None:
        if required:
            save_diagnostics()
            raise AssertionError('Timeout: second farm snapshot for ' + surface)
        return None, None
    return first, second


def assert_natural_growth(first, second):
    drops = []
    for index in range(6):
        a, b = first['plots'][index], second['plots'][index]
        assert a.get('crop') == 'cabbage', f'Farm plot {index} is not the seeded cabbage: {a}'
        assert a.get('progress', 0) > 0, f'Farm plot {index} has no real growth: {a}'
        assert a.get('remainingMs', 0) > 15 * HOUR_MS, f'Farm plot {index} is not on the real 18h clock: {a}'
        assert b.get('remainingMs', 0) < a.get('remainingMs', 0), f'Farm plot {index} did not advance between real snapshots'
        drops.append(a.get('remainingMs', 0) - b.get('remainingMs', 0))
    helper = first.get('helper') or {}
    assert helper.get('hired') is True and helper.get('plots') == 6, f'Helper is not managing six plots: {helper}'
    return drops


def click_farm_plots(page, plots=6):
    for index in range(plots):
        selector = f'[data-farm-plot="{index}"]'
        if not tappable(page, selector):
            scroll_to(page, selector)
        click(page, selector)
        wait(lambda i=index: has(page, f'[data-farm-detail="{i}"]'), f'farm plot {index} selected')
        line = page.locator(f'[data-farm-detail="{index}"] [data-farm-progress]').first
        progress = int(line.get_attribute('data-farm-progress') or 0)
        text = page.locator(f'[data-farm-detail="{index}"] small').first.inner_text()
        assert progress > 0, f'Farm plot {index} has no real growth in the UI: {progress}'
        assert '还剩' in text and '17 小时' in text and '2 小时' not in text and '2 分钟' not in text, \
            f'Farm plot {index} does not show real 18h maturity: {text}'
    # Leave the view on the first plot/top row so the saved screenshot shows all six.
    scroll_to(page, '[data-farm-plot="0"]')
    click(page, '[data-farm-plot="0"]')


def farm_action_body(surface, op):
    for item in reversed(act_responses):
        if item['surface'] != surface:
            continue
        request = post_json(item['response'])
        data = request.get('data') or {}
        if request.get('action') == 'ext' and data.get('key') == 'farm' and data.get('op') == op:
            return item_body(item)
    return None


def farm_action_count(surface, op=None):
    count = 0
    for item in act_responses:
        if item['surface'] != surface:
            continue
        request = post_json(item['response'])
        data = request.get('data') or {}
        if request.get('action') == 'ext' and data.get('key') == 'farm' and (op is None or data.get('op') == op):
            count += 1
    return count


def crop_count(view, key):
    return next((int(row.get('count', 0)) for row in view.get('harvest', []) if row.get('key') == key), 0)


def seed_count(view, key):
    return next((int(row.get('count', 0)) for row in view.get('seeds', []) if row.get('key') == key), 0)


def start_farm_desktop(data_profile, port, surface):
    start_game('stage', data_profile=data_profile, port=port, label=surface)
    page = desktop_menu()
    home_tab(page, 'ext:farm')
    wait(lambda: has(page, '[data-farm-plot="0"]'), 'farm app renders on ' + surface, 30)
    return page


def open_large_farm(page, surface):
    scroll_to(page, '[data-farm-big="open"]')
    click(page, '[data-farm-big="open"]')
    large = wait(lambda: next((candidate for candidate in desktop_pages() if has(candidate, '.fm-big')), None)
                 if surface.startswith('desktop') else (page if has(page, '.fm-big') else None), 'large farm for ' + surface, 25)
    track(large, surface + '-large')
    wait(lambda: has(large, '[data-farm-grid="expanded"]'), 'large farm grid for ' + surface)
    return large


def close_large_farm(page, large):
    click(large, '[data-farm-big="close"]')
    wait(lambda: not any(has(candidate, '.fm-big') for candidate in desktop_pages())
         if page in desktop_pages() else not has(page, '.fm-big'), 'large farm closed')


def dsh_farm_cases(page):
    open_web_menu(page)
    home_tab(page, 'ext:farm')
    wait(lambda: has(page, '[data-farm-plot="0"]'), 'DSH farm app', 30)
    assert page.locator('[data-dsh-pig]').count() == 1
    click_farm_plots(page)
    shot(page, 'dsh-farm-natural-small')
    first, second = snapshot_pair('DSH')
    drops = assert_natural_growth(first, second)
    record('DSH native farm opens six real 18h cabbage plots', plots=6,
           remainingMs=first['plots'][0]['remainingMs'], remainingDropMs=drops)
    large = open_large_farm(page, 'DSH')
    shot(large, 'dsh-farm-large')
    close_large_farm(page, large)
    record('DSH native large farm switches and renders')


def natural_farm_cases():
    surface = 'desktop-farm-natural'
    # Seed immediately before this instance starts, so "25 minutes ago" is real
    # at test time and never drifts while the earlier 17 cases run.
    run(['node', str(repo / 'apps/desktop/qa/seed-integration.mjs'), str(natural_profile), 'desktop', 'natural'], cwd=repo)
    page = start_farm_desktop(natural_profile, 9414, surface)
    click_farm_plots(page)
    shot(page, 'farm-natural-small')
    first, second = snapshot_pair(surface, required=False, seconds=10)
    drops = assert_natural_growth(first, second) if first is not None and second is not None else None
    if drops is None:
        assert page.locator('[data-farm-plot="0"]').count() == 1
    record('desktop native farm opens six real 18h cabbage plots', plots=6,
           remainingMs=first['plots'][0]['remainingMs'] if first else None,
           remainingDropMs=drops, snapshotEvidence=drops is not None)
    large = open_large_farm(page, surface)
    shot(large, 'farm-natural-large')
    close_large_farm(page, large)
    record('desktop native large farm switches and renders')
    stop_game()


def ripe_farm_cases():
    surface = 'desktop-farm-ripe'
    run(['node', str(repo / 'apps/desktop/qa/seed-integration.mjs'), str(ripe_profile), 'desktop', 'ripe'], cwd=repo)
    page = start_farm_desktop(ripe_profile, 9416, surface)
    scroll_to(page, '[data-farm-tools="toggle"]')
    click(page, '[data-farm-tools="toggle"]')
    wait(lambda: has(page, '[data-farm-helper="collect"]'), 'helper collect button')
    stock_text = wait(lambda: ((lambda text: text if '帮工收了' in text and '144' in text else None)(
        page.locator('[data-farm-helper="collect"]').first.inner_text())), 'helper stock before collect', 20)
    shot(page, 'farm-ripe-before-collect')
    before = farm_action_count(surface, 'collect')
    click(page, '[data-farm-helper="collect"]')
    wait(lambda: '帮工收了' not in page.locator('[data-farm-helper="collect"]').first.inner_text(), 'helper stock collected')
    body = poll(lambda: farm_action_body(surface, 'collect') if farm_action_count(surface, 'collect') > before else None, 6)
    if body is not None:
        after = (body.get('extViews') or {}).get('farm') or {}
        assert body.get('ok') is True, body
        assert after['helper']['stored'] == 0, after['helper']
        assert crop_count(after, 'cabbage') == 144, crop_count(after, 'cabbage')
        assert seed_count(after, 'cabbage') == 6, seed_count(after, 'cabbage')
        for index in range(6):
            plot = after['plots'][index]
            assert plot.get('crop') == 'cabbage' and plot.get('remainingMs', 0) > 17 * HOUR_MS, plot
    # A second native click must not deliver the same 144 cabbages again. The
    # bag below is the real check even if the custom-scheme response is not visible to CDP.
    click(page, '[data-farm-helper="collect"]')
    time.sleep(1.5)
    scroll_to(page, '[data-farm-bag="open"]')
    click(page, '[data-farm-bag="open"]')
    scroll_to(page, '[data-farm-bag-tab="crop"]')
    click(page, '[data-farm-bag-tab="crop"]')
    wait(lambda: has(page, '[data-farm-crop="cabbage"]'), 'cabbage bag row')
    label = page.locator('[data-farm-crop="cabbage"]').first.get_attribute('aria-label') or ''
    assert '144' in label, label
    shot(page, 'farm-ripe-bag')
    scroll_to(page, '[data-farm-bag-tab="seed"]')
    click(page, '[data-farm-bag-tab="seed"]')
    wait(lambda: has(page, '[data-farm-seed="cabbage"]'), 'cabbage seed row')
    seed_text = page.locator('[data-farm-seed="cabbage"]').first.inner_text()
    assert re.search(r'×\s*6(?!\d)', seed_text), seed_text
    scroll_to(page, '[data-farm-back="true"]')
    click(page, '[data-farm-back="true"]')
    scroll_to(page, '[data-farm-plot="0"]')
    click(page, '[data-farm-plot="0"]')
    wait(lambda: has(page, '[data-farm-detail="0"]'), 'replanted plot selected')
    replant_text = page.locator('[data-farm-detail="0"] small').first.inner_text()
    assert '还剩' in replant_text and '17 小时' in replant_text and '2 小时' not in replant_text, replant_text
    assert page.locator('[data-farm-detail="0"]').first.inner_text().find('小白菜') >= 0
    shot(page, 'farm-ripe-collected')
    record('desktop natural helper auto-harvests into stock and replants same crop', stored=144, seedsLeft=6,
           responseEvidence=body is not None)
    record('desktop native helper collect moves stock once without duplicate delivery', cabbage=144)
    stop_game()


try:
    run(['openbox', '--version'])
    launch(['openbox'], 'window-manager.log')
    launch(['picom', '--backend', 'xrender'], 'compositor.log')
    for directory, role, fixture in [(legacy / 'dsh-piggy', 'desktop', 'default'), (source, 'source', 'natural')]:
        run(['node', str(repo / 'apps/desktop/qa/seed-integration.mjs'), str(directory), role, fixture], cwd=repo)
    (legacy / 'dsh-piggy/proxy.json').replace(legacy / 'proxy.json')
    original_legacy = {str(p.relative_to(legacy)): hashlib.sha256(p.read_bytes()).hexdigest() for p in legacy.rglob('*') if p.is_file()}
    run(['node', str(cli), 'plugin', '--profile', 'web', 'add', str(tgz)], env=env, timeout=240)
    installed = home / 'profiles/web/node_modules/dsh-piggy'
    assert installed.exists() and installed.resolve().is_relative_to(home.resolve()), 'DSH must load the private installed tgz, not a worktree link'
    with tarfile.open(tgz) as archive:
        wanted = archive.extractfile('package/adapters/dsh/index.js').read()
    assert (installed / 'adapters/dsh/index.js').read_bytes() == wanted
    record('real npm package installation', adapterSha256=hashlib.sha256(wanted).hexdigest())
    image.chmod(0o755)
    with sync_playwright() as pw:
        pet = start_game('split', use_default=True)
        assert (profile / 'state.json').exists() and not (profile / 'dsh-piggy').exists()
        assert original_legacy == {str(p.relative_to(legacy)): hashlib.sha256(p.read_bytes()).hexdigest() for p in legacy.rglob('*') if p.is_file()}
        record('native Linux default piggy directory migrates legacy without changing originals', files=len(original_legacy))
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
                               '--user-data-dir=' + str(private / 'browser'), '--window-size=1180,850', '--window-position=20,20',
                               '--no-first-run', url], 'browser.log')
        web_browser = wait(lambda: pw.chromium.connect_over_cdp('http://127.0.0.1:9413'), 'DSH browser')
        page = wait(lambda: next((p for p in browser_pages(web_browser) if '3088' in p.url), None), 'DSH page')
        track(page, 'DSH')
        page.on('response', lambda response: responses.append(response) if '/dsh-piggy/act' in response.url and response.request.method == 'POST' else None)
        wait(lambda: has(page, '.dp-pig:visible'), 'DSH plugin activation', 90)
        assert page.locator('[data-dsh-pig]').count() == 1
        wait(lambda: has(page, 'button:has-text("Continue")'), 'fresh DSH host welcome notice')
        click(page, 'button:has-text("Continue")')
        wait(lambda: not has(page, 'button:has-text("Continue")'), 'native host welcome acknowledgement')
        open_web_menu(page)
        home_tab(page, 'bag')
        click(page, '[data-bag="food"]')
        click(page, '[data-use="apple"]')
        wait(lambda: responses and responses[-1].json().get('inventory', {}).get('apple') == 2, 'DSH native feeding')
        record('DSH activation and real feeding', applesAfter=2)
        with page.expect_response(lambda r: '/dsh-piggy/act' in r.url and r.request.method == 'POST'
                                  and r.request.post_data_json.get('action') == 'pet', timeout=8000) as pet_response:
            click(page, '.dp-pig')
        pet_result = pet_response.value.json()
        (out / 'pet-response.json').write_text(json.dumps({'http': pet_response.value.status,
            'request': pet_response.value.request.post_data_json, 'ok': pet_result.get('ok'),
            'reason': pet_result.get('reason'), 'pending': pet_result.get('pending')}, ensure_ascii=False, indent=2))
        if not has(page, '.dp-reply:visible'):
            save_diagnostics()
        assert has(page, '.dp-reply:visible'), 'The prepared back-pet history did not offer its real reply'
        before = page.locator('.dp-bubble').inner_text()
        click(page, '.dp-reply:visible')
        wait(lambda: page.locator('.dp-bubble').inner_text() != before, 'reply follow-up rendered')
        shot(page, 'dsh-reply')
        record('DSH native pet reply has a follow-up')
        with page.expect_navigation(wait_until='domcontentloaded', timeout=90000):
            key('ctrl+r')
        wait(lambda: has(page, '.dp-pig:visible'), 'DSH refresh')
        assert page.locator('[data-dsh-pig]').count() == 1
        record('DSH native refresh preserves single activation')
        open_web_menu(page)
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
        with page.expect_navigation(wait_until='domcontentloaded', timeout=90000):
            key('Return')
        wait(lambda: has(page, '[data-external-offline="true"]'), 'DSH restart keeps external offline mode', 90)
        assert hashlib.sha256((source / 'state.json').read_bytes()).hexdigest() == frozen
        record('real DSH host restart preserves external mode and paused source')
        open_web_menu(page)
        home_tab(page, 'settings')
        scroll_to(page, '[data-external-action="manage"]')
        click(page, '[data-external-action="manage"]')
        click(page, '[data-external-action="manage-withdraw"]')
        click(page, '[data-external-action="withdraw-go"]')
        wait(lambda: page.locator('[data-dsh-pig]').get_attribute('data-link') is None and has(page, '.dp-pig:visible'), 'withdraw restores embedded pig')
        shot(page, 'dsh-withdraw-offline')
        record('native offline withdrawal restores embedded pig')
        pet = start_game('stage')
        if any(has(p, '[data-home-dot]:visible') for p in desktop_pages()):
            click(pet, '.dp-pig', 3)
        home_tab(page, 'settings')
        scroll_to(page, '[data-external-action="recheck"]')
        click(page, '[data-external-action="recheck"]')
        wait(lambda: has(page, '[data-external-action="connect"]:visible'), 'desktop rediscovery for merge')

        def merge_preview():
            click(page, '[data-external-action="connect"]')
            click(page, '[data-external-choice="merge"]')
            click(page, '[data-external-action="choose-next"]')
            wait(lambda: has(page, '[data-external-submit]'), 'real merge preview')
            conflicts = page.locator('[data-external-conflict]').evaluate_all('(xs)=>xs.map(x=>x.getAttribute("data-external-conflict"))')
            for conflict in conflicts:
                selector = '[data-external-conflict="'+conflict+'"] [data-external-choice="target"]'
                scroll_to(page, selector)
                click(page, selector)
            # The real duplicate guard also considers matching early badges.
            # Explicitly choose addition for these two private test pigs.
            duplicate = '[data-external-duplicate] [data-external-choice="merge"]'
            if has(page, duplicate):
                scroll_to(page, duplicate)
                click(page, duplicate)
            (out / 'merge-selection.json').write_text(clean(json.dumps(page.evaluate(
                '() => ({body:document.body.innerText,disabled:document.querySelector("[data-external-submit]")?.disabled})'
            ), ensure_ascii=False, indent=2)))

        merge_preview()
        scroll_to(page, '[data-external-action="preview-cancel"]')
        live_dialog = page.locator('[data-external-dialog="preview"]').element_handle()
        scroll_before = live_dialog.evaluate('e=>e.scrollTop')
        countdown = page.locator('[data-external-dialog="preview"] .dp-ext-note').first.inner_text()
        with page.expect_response(lambda r: '/dsh-piggy/state' in r.url and r.request.method == 'GET', timeout=15000):
            pass
        wait(lambda: page.locator('[data-external-dialog="preview"] .dp-ext-note').first.inner_text() != countdown, 'real poll redraws preview')
        assert live_dialog.evaluate('e=>e.isConnected'), 'Polling replaced the native scroll container'
        assert abs(live_dialog.evaluate('e=>e.scrollTop') - scroll_before) <= 2, 'Polling moved the preview scroll position'
        record('native preview scroll container and position survive a real DSH poll')
        click(page, '[data-external-action="preview-cancel"]')
        wait(lambda: not has(page, '[data-external-dialog]'), 'cancel preview closes wizard')
        assert read_state(source)['coins'] == 500 and read_state(source)['inventory']['apple'] == 2
        record('native merge preview cancellation preserves source assets')
        merge_preview()
        scroll_to(page, '[data-external-submit]')
        shot(page, 'merge-preview')
        click(page, '[data-external-submit]')
        window = wait(lambda: run(['xdotool', 'search', '--onlyvisible', '--name', 'DSH.*合并']).strip().splitlines()[0], 'native merge confirmation')
        geometry = dict(line.split('=', 1) for line in run(['xdotool', 'getwindowgeometry', '--shell', window]).splitlines())
        rect = ','.join(geometry[k] for k in ['X', 'Y', 'WIDTH', 'HEIGHT'])
        run(['scrot', '-o', '-a', rect, str(out / 'merge-native-confirm.png')])
        run(['xdotool', 'windowactivate', '--sync', window])
        # The native dialog starts on Cancel; move focus to Allow, then confirm.
        key('Tab', 'Return')
        wait(lambda: has(page, '[data-external-dialog="success"]'), 'native-confirmed merge succeeds', 70)
        assert read_state(profile)['coins'] == 1500
        assert read_state(profile)['inventory']['apple'] == 6
        assert not (source / 'state.json').exists(), 'Merged source must be retired'
        wait(lambda: '1500' in page.locator('.dp-hud').inner_text(), 'merged DSH balance rendered')
        wait(lambda: '1,500' in page.locator('[data-external-pet]').inner_text(), 'merged settings summary rendered')
        wait(lambda: '1500' in pet.locator('.dp-hud').inner_text(), 'merged desktop balance rendered')
        shot(page, 'merge-success')
        record('native confirmed merge applies assets once and retires source', coins=1500, apples=6)
        scroll_to(page, '[data-external-action="success-rollback"]')
        click(page, '[data-external-action="success-rollback"]')
        click(page, '[data-external-action="rollback-go"]')
        wait(lambda: (source / 'state.json').exists(), 'rollback restores source')
        wait(lambda: read_state(profile)['coins'] == 1000, 'rollback restores desktop')
        assert read_state(profile)['inventory']['apple'] == 4
        assert read_state(source)['coins'] == 500 and read_state(source)['inventory']['apple'] == 2
        wait(lambda: page.locator('[data-dsh-pig]').get_attribute('data-link') is None
             and '内嵌猪' in page.locator('.dp-hud').inner_text() and '500' in page.locator('.dp-hud').inner_text(), 'rollback embedded identity and balance rendered')
        wait(lambda: '1,000' in page.locator('[data-external-pet]').inner_text(), 'rollback settings summary rendered')
        wait(lambda: '1000' in pet.locator('.dp-hud').inner_text(), 'rollback desktop balance rendered')
        shot(page, 'merge-rollback')
        record('native rollback restores both pigs and preserves premerge care')
        dsh_farm_cases(page)
        stop_game()
        natural_farm_cases()
        ripe_farm_cases()
        assert not errors, errors
        record('page error check', errors=0)
        print('CASES:', len(checks), 'PAGEERRORS:', len(errors), flush=True)
        (out / 'report.json').write_text(json.dumps({'ok': True, 'cases': checks, 'errors': errors,
            'input': 'native XTest mouse/keyboard', 'browser': 'Playwright read-only CDP; Browser plugin not available',
            'appImageSha256': hashlib.sha256(image.read_bytes()).hexdigest(),
            'npmSha256': hashlib.sha256(tgz.read_bytes()).hexdigest(),
            'linuxDisplay': 'Xvfb/Openbox/picom software rendering; --no-sandbox --disable-gpu --ozone-platform=x11'}, ensure_ascii=False, indent=2))
except Exception as error:
    (out / 'report.json').write_text(json.dumps({'ok': False, 'error': clean(error), 'cases': checks, 'errors': errors}, ensure_ascii=False, indent=2))
    for base, prefix in [(profile, 'desktop-'), (natural_profile, 'farm-natural-'), (ripe_profile, 'farm-ripe-')]:
        for name in ['piggy.log', 'stage.log', 'window.json']:
            if (base / name).exists():
                (out / (prefix + name)).write_text(clean((base / name).read_text()))
    print('CASES:', len(checks), 'PAGEERRORS:', len(errors), flush=True)
    raise
finally:
    for proc in reversed(children):
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=15)
            except subprocess.TimeoutExpired:
                proc.kill()
