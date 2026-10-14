# Собирает src/data/catalog.json из сырых данных data/raw и скачивает картинки в public/img.
# Запуск: npm run data  (повторный запуск не качает уже скачанные картинки)
import hashlib, json, os, re, ssl, subprocess, sys, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw')
IMG = os.path.join(ROOT, 'public', 'img')
CACHE = os.path.join(RAW, 'img-cache')  # оригиналы PNG/JPG, в git не идут
OUT = os.path.join(ROOT, 'src', 'data', 'catalog.json')
BASE = 'https://store.starline.ru'
UPDATED = '2026-10-14'

cat = json.load(open(os.path.join(RAW, 'catalog.json')))
raw = json.load(open(os.path.join(RAW, 'products.json')))
cmp = json.load(open(os.path.join(RAW, 'compare.json')))

# ── Картинки ───────────────────────────────────────────────
ctx = ssl.create_default_context(cafile='/etc/ssl/cert.pem')
os.makedirs(IMG, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)
fails, jobs, used = [], [], set()

def img(path, size):
    """Скачать картинку StarLine в кэш и поставить в очередь на WebP до size px; вернуть путь от public/."""
    if not path:
        return None
    h = hashlib.sha1(path.encode()).hexdigest()[:12]
    src = os.path.join(CACHE, h + (os.path.splitext(path)[1].lower() or '.png'))
    name = f'{h}-{size}.webp'
    if not os.path.exists(src):
        url = BASE + urllib.parse.quote(path)
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            open(src, 'wb').write(urllib.request.urlopen(req, context=ctx, timeout=30).read())
        except Exception as e:  # noqa: BLE001 – пропуск картинки не должен ронять сборку
            fails.append(f'{path}: {e}')
            return None
    if name not in used:
        used.add(name)
        jobs.append([src, os.path.join(IMG, name), size])
    return 'img/' + name

# ── Функции фильтра (как на store.starline.ru, без промо КАСКО/частями) ──
FILTERS = [
    ('AUTOZ', 'Автозапуск'), ('WO_AUTOZ', 'Без автозапуска'), ('PHONE_CONTROL', 'Управление с телефона'),
    ('BLUETOOTH', 'Авторизация по метке'), ('FREE', 'Свободные руки'), ('CAN', 'Блокировка по CAN'),
    ('PODOG', 'Управление подогревом'), ('DIAG', 'Умная автодиагностика'), ('FUEL', 'Пробег и уровень топлива'),
    ('FREE_MONITORING', 'Бесплатный мониторинг'), ('ONLINE_MONITORING', 'Онлайн-мониторинг'),
    ('PAIDPARKING', 'Оплата парковок'),
]
hints = {f['name'].replace('FILTER_CH_', ''): f['title'] for f in cat['features']}
func_of = {}
for key, urls in cat['map'].items():
    for u in urls:
        func_of.setdefault(u, set()).add(key.replace('FILTER_CH_', '').replace('FILTER_OTHER_', ''))

# ── Матрица сравнения: параметры с ключами ─────────────────
def pkey(title):
    return 'p' + hashlib.sha1(title.encode()).hexdigest()[:6]

params, matrix = [], {}
for sec in cmp:
    props = []
    for pr in sec['props']:
        k = pkey(pr['title'].strip())
        props.append({'key': k, 'title': pr['title'].strip(), 'desc': pr['desc'], 'icon': img(pr['icon'], 96)})
        for pid, v in pr['values'].items():
            if isinstance(v, str):
                v = 'опция' if v.startswith('опция') else v
            matrix.setdefault(pid, {})[k] = v
    params.append({'title': sec['title'], 'props': props})

def by_title(start):
    for sec in params:
        for pr in sec['props']:
            if pr['title'].startswith(start):
                return pr['key']
    raise SystemExit(f'нет параметра «{start}» в compare.json')

K_CAN = by_title('Интерфейс 2CAN')
K_GSM, K_GPS, K_RELAY = by_title('Интерфейс GSM'), by_title('Антенна GPS'), by_title('Дополнительное реле')
K_CELL = by_title('Управление по GSM')

# ── Семейства: один корпус/линейка, внутри – комплектации ──
FAMILIES = [
    ('s', 'Серия S', 'Без брелока: управление со смартфона, авторизация по метке', r'^starline_s'),
    ('e', 'Серия E', 'С ЖК-брелоком обратной связи', r'^starline_e'),
    ('a93v2', 'A93 v2 2CAN+2LIN', 'С брелоком и цифровой шиной 2CAN+2LIN', r'^starline_a93(_v2)?_2can'),
    ('a', 'Серия A', 'Простые комплексы с ЖК-брелоком', r'^starline_a'),
    ('b', 'B97 v2', 'Флагман: 3CAN+FD+4LIN, LTE и реле блокировки', r'^starline_b97'),
    ('t', 'T94 v2', 'Для грузового транспорта, 24 В', r'^starline_t94'),
]

def family(slug):
    for key, *_rest, rx in FAMILIES:
        if re.search(rx, slug):
            return key
    raise SystemExit(f'семейство не найдено: {slug}')

def link_of(p, m):
    """Связь: в матрице StarLine есть пропуски (S7 GPS без LTE), поэтому сначала название, потом матрица и описание."""
    name, gsm = p['name'], m.get(K_GSM)
    if 'GSM' in name:
        return 'GSM'
    if 'LTE' in name:
        return '4G'
    if 'lora' in p['slug']:
        return 'LoRa'
    if gsm in ('2G', 'LTE(4G)'):
        return {'2G': 'GSM', 'LTE(4G)': '4G'}[gsm]
    if m.get(K_CELL) is True:
        text = ' '.join(i['title'] + ' ' + i['text'] for g in p['features'] for i in g['items'])
        return '4G' if len(re.findall(r'LTE|4G', text)) >= 4 else 'GSM'
    return 'нет'

def attrs(p, m, funcs):
    """Оси комплектации. Метки и брелок – по составу коробки: в матрице сравнения StarLine они местами неверны."""
    eq = [e['title'] for e in p['equipment']]
    tags = 2 if any('метка (2 шт.)' in t for t in eq) else (1 if any(re.match(r'(Брелок-)?[Мм]етка', t) for t in eq) else 0)
    lcd = 'Основной брелок' in eq
    fob = 'BT-брелок' if any(t.startswith('BT-брелок') for t in eq) else (
        ('ЖК-брелок + доп.' if any(t in ('Дополнительный брелок', 'Брелок без обратной связи') for t in eq) else 'ЖК-брелок')
        if lcd else 'нет')
    return {
        'autostart': 'AUTOZ' in funcs,
        'bt': ' BT' in p['name'] or 'BLUETOOTH' in funcs,
        'tags': tags,
        'fob': fob,
        'can': m.get(K_CAN) if isinstance(m.get(K_CAN), str) else 'нет',
        'link': link_of(p, m),
        'gps': m.get(K_GPS) is True,
        'relay': m.get(K_RELAY) if isinstance(m.get(K_RELAY), str) else 'нет',
    }

order = [i['url'] for i in cat['items']]
products = []
for p in sorted(raw.values(), key=lambda x: order.index(x['url'])):
    funcs = func_of.get(p['url'], set())
    m = matrix.get(p['id'], {})
    gallery = [g for g in (img(x, 900) for x in p['gallery']) if g]
    products.append({
        'slug': p['slug'], 'id': p['id'], 'name': p['name'], 'type': p['type'], 'lead': p['lead'],
        'price': p['price'], 'family': family(p['slug']),
        'image': gallery[0] if gallery else None, 'gallery': gallery,
        'funcs': [k for k, _ in FILTERS if k in funcs],
        'attrs': attrs(p, m, funcs),
        'params': m,
        'features': [{'title': g['title'], 'items': [{'title': i['title'], 'text': i['text'], 'icon': img(i['icon'], 96)}
                                                     for i in g['items']]} for g in p['features']],
        'equipment': [{'title': e['title'], 'img': img(e['img'], 480)} for e in p['equipment']],
        'docs': p['docs'], 'warranty': p['warranty'],
    })

fams = []
for key, title, desc, _rx in FAMILIES:
    members = [p['slug'] for p in products if p['family'] == key]
    if members:
        fams.append({'key': key, 'title': title, 'desc': desc, 'members': members})

data = {
    'updated': UPDATED,
    'source': BASE + '/catalog/avtosignalizatsii/',
    'filters': [{'key': k, 'title': t, 'hint': hints.get(k, '')} for k, t in FILTERS],
    'families': fams,
    'params': params,
    'products': products,
}
# WebP через sharp (ставится вместе с Astro); готовые файлы не пересобираются
todo = [j for j in jobs if not os.path.exists(j[1])]
if todo:
    js = ("import sharp from 'sharp'; const jobs = JSON.parse(process.argv[1]);"
          "for (const [s, d, n] of jobs) await sharp(s).resize(n, n, {fit: 'inside', withoutEnlargement: true})"
          ".webp({quality: 82}).toFile(d);")
    subprocess.run(['node', '--input-type=module', '-e', js, json.dumps(todo)], cwd=ROOT, check=True)
for f in os.listdir(IMG):  # убрать картинки, на которые больше никто не ссылается
    if f not in used:
        os.remove(os.path.join(IMG, f))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(data, open(OUT, 'w'), ensure_ascii=False, indent=1)
print(f'товаров {len(products)}, семейств {len(fams)}, параметров {sum(len(s["props"]) for s in params)}, '
      f'картинок {len(os.listdir(IMG))}, ошибок загрузки {len(fails)}')
for f in fails:
    print('  !', f, file=sys.stderr)
