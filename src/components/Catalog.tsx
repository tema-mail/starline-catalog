// Каталог: фильтр по функциям (как на store.starline.ru), серии и цене, сортировка, кнопка «в сравнение».
// Состояние фильтра живёт в адресе (?f=…&s=…&p=…&o=…), чтобы подборку можно было переслать ссылкой.
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Attrs } from '../lib/catalog';
import { COMPARE_MAX, toggleCompare, useCompare } from '../lib/compare';

export interface Item {
  slug: string; name: string; price: number; image: string | null;
  family: string; familyTitle: string; funcs: string[]; attrs: Attrs;
}
interface Props {
  items: Item[];
  filters: { key: string; title: string; hint: string }[];
  families: { key: string; title: string }[];
  base: string;
}

const PRICES = [
  { key: 'all', title: 'Все', test: () => true },
  { key: 'lt15', title: 'до 15 000 ₽', test: (n: number) => n < 15000 },
  { key: '15-25', title: '15–25 000 ₽', test: (n: number) => n >= 15000 && n < 25000 },
  { key: '25-35', title: '25–35 000 ₽', test: (n: number) => n >= 25000 && n < 35000 },
  { key: 'gt35', title: 'от 35 000 ₽', test: (n: number) => n >= 35000 },
];
const SORTS = [
  { key: 'pop', title: 'Сначала популярные' },
  { key: 'cheap', title: 'Сначала дешевле' },
  { key: 'dear', title: 'Сначала дороже' },
];
// Взаимоисключающие функции: выбор одной снимает другую.
const EXCLUSIVE: Record<string, string> = { AUTOZ: 'WO_AUTOZ', WO_AUTOZ: 'AUTOZ' };

const rub = (n: number) => n.toLocaleString('ru-RU') + ' ₽';
const tagsWord = (n: number) => (n === 1 ? '1 метка' : `${n} метки`);

function pills(a: Attrs): string[] {
  const out: string[] = [];
  if (a.autostart) out.push('Автозапуск');
  if (a.tags) out.push(tagsWord(a.tags));
  if (a.link !== 'нет') out.push(a.link);
  if (a.gps) out.push('GPS');
  if (a.can !== 'нет' && a.can !== 'опция') out.push(a.can.split('+')[0]);
  return out;
}

function readUrl() {
  const q = new URLSearchParams(location.search);
  return {
    funcs: (q.get('f') || '').split(',').filter(Boolean),
    family: q.get('s') || 'all',
    price: q.get('p') || 'all',
    sort: q.get('o') || 'pop',
  };
}

export default function Catalog({ items, filters, families, base }: Props) {
  const [funcs, setFuncs] = useState<string[]>([]);
  const [family, setFamily] = useState('all');
  const [price, setPrice] = useState('all');
  const [sort, setSort] = useState('pop');
  const [toast, setToast] = useState('');
  const compare = useCompare();

  useEffect(() => {
    const s = readUrl();
    setFuncs(s.funcs.filter((f) => filters.some((x) => x.key === f)));
    setFamily(families.some((f) => f.key === s.family) ? s.family : 'all');
    setPrice(PRICES.some((p) => p.key === s.price) ? s.price : 'all');
    setSort(SORTS.some((x) => x.key === s.sort) ? s.sort : 'pop');
  }, []);

  useEffect(() => {
    const q = new URLSearchParams();
    if (funcs.length) q.set('f', funcs.join(','));
    if (family !== 'all') q.set('s', family);
    if (price !== 'all') q.set('p', price);
    if (sort !== 'pop') q.set('o', sort);
    const qs = q.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }, [funcs, family, price, sort]);

  // Подходит ли товар при заданных условиях – одна функция для списка и для счётчиков на чипах.
  const match = (it: Item, f: string[], fam: string, pr: string) =>
    f.every((k) => it.funcs.includes(k)) &&
    (fam === 'all' || it.family === fam) &&
    PRICES.find((p) => p.key === pr)!.test(it.price);

  const shown = useMemo(() => {
    const list = items.filter((it) => match(it, funcs, family, price));
    if (sort === 'cheap') list.sort((a, b) => a.price - b.price);
    if (sort === 'dear') list.sort((a, b) => b.price - a.price);
    return list;
  }, [items, funcs, family, price, sort]);

  const withFunc = (k: string) => {
    if (funcs.includes(k)) return funcs.filter((x) => x !== k);
    return [...funcs.filter((x) => x !== EXCLUSIVE[k]), k];
  };
  const countFunc = (k: string) => items.filter((it) => match(it, withFunc(k), family, price)).length;
  const countFam = (k: string) => items.filter((it) => match(it, funcs, k, price)).length;
  const countPrice = (k: string) => items.filter((it) => match(it, funcs, family, k)).length;
  const dirty = funcs.length > 0 || family !== 'all' || price !== 'all';

  const reset = () => { setFuncs([]); setFamily('all'); setPrice('all'); };

  const onCompare = (slug: string) => {
    if (!toggleCompare(slug)) {
      setToast(`В сравнении уже ${COMPARE_MAX} товаров – уберите один, чтобы добавить новый`);
      setTimeout(() => setToast(''), 3500);
    }
  };

  return (
    <div class="cat">
      <section class="filters" aria-label="Фильтр">
        <div class="frow">
          <span class="frow__title" id="f-func">Функции</span>
          <div class="chips" role="group" aria-labelledby="f-func">
            <button type="button" class="chip" aria-pressed={funcs.length === 0} onClick={() => setFuncs([])}>Все</button>
            {filters.map((f) => {
              const on = funcs.includes(f.key);
              const n = on ? shown.length : countFunc(f.key);
              return (
                <button type="button" class="chip" aria-pressed={on} title={f.hint} disabled={!on && n === 0}
                  onClick={() => setFuncs(withFunc(f.key))}>
                  {f.title} {!on && <span class="chip__n">{n}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div class="frow">
          <span class="frow__title" id="f-fam">Серия</span>
          <div class="chips" role="group" aria-labelledby="f-fam">
            <button type="button" class="chip" aria-pressed={family === 'all'} onClick={() => setFamily('all')}>Все</button>
            {families.map((f) => {
              const n = countFam(f.key);
              return (
                <button type="button" class="chip" aria-pressed={family === f.key} disabled={family !== f.key && n === 0}
                  onClick={() => setFamily(family === f.key ? 'all' : f.key)}>
                  {f.title} {family !== f.key && <span class="chip__n">{n}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div class="frow">
          <span class="frow__title" id="f-price">Цена</span>
          <div class="chips" role="group" aria-labelledby="f-price">
            {PRICES.map((p) => {
              const n = countPrice(p.key);
              return (
                <button type="button" class="chip" aria-pressed={price === p.key} disabled={p.key !== 'all' && price !== p.key && n === 0}
                  onClick={() => setPrice(price === p.key ? 'all' : p.key)}>
                  {p.title} {p.key !== 'all' && price !== p.key && <span class="chip__n">{n}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div>
        <div class="toolbar">
          <span class="toolbar__count" role="status">Найдено: {shown.length}</span>
          <div class="toolbar__right">
            {dirty && <button type="button" class="linkbtn" onClick={reset}>Сбросить</button>}
            <label class="sr-only" for="sort">Сортировка</label>
            <select id="sort" class="select" value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value)}>
              {SORTS.map((s) => <option value={s.key}>{s.title}</option>)}
            </select>
          </div>
        </div>

        {shown.length === 0 ? (
          <div class="empty">
            <p>Под такой набор функций комплексов нет.</p>
            <button type="button" class="btn btn--ghost" onClick={reset}>Сбросить фильтр</button>
          </div>
        ) : (
          <div class="grid">
            {shown.map((it, i) => {
              const href = `${base}catalog/${it.slug}/`;
              const inCmp = compare.includes(it.slug);
              return (
                <article class="pcard" key={it.slug}>
                  <a class="pcard__img" href={href} tabIndex={-1} aria-hidden="true">
                    {it.image && <img src={base + it.image} alt="" width={400} height={300}
                      loading={i < 4 ? 'eager' : 'lazy'} decoding="async" />}
                  </a>
                  <div class="pcard__body">
                    <span class="pcard__series">{it.familyTitle}</span>
                    <a class="pcard__name" href={href}>{it.name}</a>
                    <div class="pills">{pills(it.attrs).map((p) => <span class="pill">{p}</span>)}</div>
                    <div class="pcard__foot">
                      <span class="price">{rub(it.price)}</span>
                      <button type="button" class="cmp-toggle" aria-pressed={inCmp}
                        aria-label={inCmp ? `Убрать ${it.name} из сравнения` : `Добавить ${it.name} в сравнение`}
                        title={inCmp ? 'Убрать из сравнения' : 'Добавить в сравнение'} onClick={() => onCompare(it.slug)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          {inCmp ? <path d="M5 12l5 5 9-10" /> : <><path d="M4 20V10M10 20V4M16 20v-7M20 20H3" /></>}
                        </svg>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {toast && <p class="toast" role="alert">{toast}</p>}
      </div>
    </div>
  );
}
