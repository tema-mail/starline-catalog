// Карточка товара с конфигуратором: варианты семейства переключаются на месте, адрес меняется на выбранный вариант.
import { useEffect, useState } from 'preact/hooks';
import { configurator, rub, type Product } from '../lib/catalog';
import { COMPARE_MAX, toggleCompare, useCompare } from '../lib/compare';

interface Props { members: Product[]; initial: string; familyTitle: string; base: string }
type Tab = 'features' | 'box' | 'docs' | 'warranty';

const delta = (n: number) => (n === 0 ? 'та же цена' : (n > 0 ? '+' : '−') + rub(Math.abs(n)));

// Основной блок и SIM-карта есть в любой коробке, у вариантов отличается только их описание – это не изменение.
const boxKey = (t: string) => (/^(Основной|Центральный) блок/.test(t) ? 'блок' : t.startsWith('SIM-карта') ? 'sim' : t);

/** Что изменилось в коробке при переходе prev → cur. */
function boxDiff(prev: Product | null, cur: Product) {
  if (!prev || prev === cur) return { added: new Set<string>(), removed: [] as string[] };
  const was = new Set(prev.equipment.map((e) => boxKey(e.title)));
  const now = new Set(cur.equipment.map((e) => boxKey(e.title)));
  return {
    added: new Set(cur.equipment.map((e) => e.title).filter((t) => !was.has(boxKey(t)))),
    removed: prev.equipment.map((e) => e.title).filter((t) => !now.has(boxKey(t))),
  };
}

export default function ProductCard({ members, initial, familyTitle, base }: Props) {
  const [slug, setSlug] = useState(initial);
  const [prevSlug, setPrevSlug] = useState<string | null>(null);
  const [changed, setChanged] = useState<string[]>([]);
  const [shot, setShot] = useState(0);
  const [tab, setTab] = useState<Tab>('features');
  const [full, setFull] = useState(false);
  const compare = useCompare();

  const p = members.find((m) => m.slug === slug)!;
  const prev = prevSlug ? members.find((m) => m.slug === prevSlug)! : null;
  const axes = configurator(p, members);
  const box = boxDiff(prev, p);
  const inCmp = compare.includes(p.slug);
  const pageUrl = (s: string) => `${base}catalog/${s}/`;

  // Назад/вперёд в браузере – между вариантами без перезагрузки.
  useEffect(() => {
    const onPop = () => {
      const s = location.pathname.replace(/\/$/, '').split('/').pop();
      if (s && members.some((m) => m.slug === s)) { setPrevSlug(null); setChanged([]); setSlug(s); setShot(0); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Заголовок вкладки и последнее звено крошек (их рендерит страница) – под текущий вариант.
  useEffect(() => {
    document.title = `${p.name} – ${rub(p.price)}`;
    const crumb = document.querySelector('[data-crumb-name]');
    if (crumb) crumb.textContent = p.name;
  }, [p]);

  const go = (target: Product, changes: string[]) => {
    if (target.slug === slug) return;
    setPrevSlug(slug);
    setChanged(changes);
    setSlug(target.slug);
    setShot(0);
    history.pushState(null, '', pageUrl(target.slug));
  };

  const [full2, setFull2] = useState(false);
  const onCompare = () => setFull2(!toggleCompare(p.slug));

  const tabs: { key: Tab; title: string; n?: number }[] = [
    { key: 'features', title: 'Характеристики', n: p.features.reduce((n, g) => n + g.items.length, 0) },
    { key: 'box', title: 'Комплектация', n: p.equipment.length },
    ...(p.docs.length ? [{ key: 'docs' as Tab, title: 'Инструкции', n: p.docs.length }] : []),
    ...(p.warranty ? [{ key: 'warranty' as Tab, title: 'Гарантия' }] : []),
  ];
  const others = [...members].sort((a, b) => a.price - b.price);

  return (
    <>
      <div class="pd">
        <div class="pd__media">
          <div class="gal">
            <div class="gal__main swap" key={p.slug + shot}>
              {p.gallery[shot] && <img src={base + p.gallery[shot]} alt={p.name} width={900} height={675} fetchpriority="high" decoding="async" />}
            </div>
            {p.gallery.length > 1 && (
              <div class="gal__thumbs" role="group" aria-label="Фото">
                {p.gallery.map((g, i) => (
                  <button type="button" class="gal__thumb" aria-pressed={i === shot} aria-label={`Фото ${i + 1}`} onClick={() => setShot(i)}>
                    <img src={base + g} alt="" width={76} height={76} loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div class="buy">
            <span class="buy__price swap" key={p.price}>{rub(p.price)}</span>
            <button type="button" class={`btn btn--wide ${inCmp ? 'btn--ghost' : 'btn--primary'}`} onClick={onCompare}>
              {inCmp ? '✓ В сравнении – убрать' : 'Добавить в сравнение'}
            </button>
            <a class="btn btn--ghost btn--wide" href={`https://store.starline.ru/catalog/avtosignalizatsii/${p.slug}/`} target="_blank" rel="noopener">Открыть на store.starline.ru</a>
            {full2 && !inCmp && <p class="buy__note" role="alert">В сравнении уже {COMPARE_MAX} товаров – уберите один в лотке внизу.</p>}
            <p class="buy__note">Цена ориентировочная, не окончательная – уточняйте перед заказом.</p>
          </div>
        </div>

        <div class="pd__info">
          <span class="pd__type">{familyTitle} · {p.type || 'Охранно-телематический комплекс'}</span>
          <h1 class="pd__name swap" key={p.slug}>{p.name}</h1>
          <p class="pd__price swap" key={'pr' + p.price}>{rub(p.price)}</p>
          <p class="pd__lead">{full || p.lead.length < 240 ? p.lead : p.lead.slice(0, p.lead.lastIndexOf(' ', 220)) + '…'}
            {p.lead.length >= 240 && <button type="button" class="linkbtn" onClick={() => setFull(!full)}>{full ? 'Свернуть' : 'Читать полностью'}</button>}
          </p>

          {axes.length > 0 && (
            <section class="conf" aria-labelledby="conf-h">
              <div class="conf__head">
                <h2 id="conf-h">Комплектация</h2>
                <span class="muted">Вариантов в серии: {members.length}</span>
              </div>
              {axes.map(({ axis, options }) => (
                <div class="conf__axis" role="group" aria-labelledby={`ax-${axis.key}`}>
                  <span class="conf__title" id={`ax-${axis.key}`}>{axis.title}{axis.hint && <span class="conf__hint">{axis.hint}</span>}</span>
                  <div class="conf__opts">
                    {options.map((o) => {
                      const cur = o.target.slug === p.slug;
                      const d = o.target.price - p.price;
                      return (
                        <button type="button" class={`opt${!cur && !o.exact ? ' opt--far' : ''}`} aria-pressed={cur}
                          title={!cur && o.changes.length ? `Перейдёт на ${o.target.name}; также: ${o.changes.join(', ')}` : o.target.name}
                          onClick={() => go(o.target, o.changes)}>
                          <span class="opt__label">{o.label}</span>
                          <span class={`opt__delta${d > 0 ? ' opt__delta--up' : d < 0 ? ' opt__delta--down' : ''}`}>{cur ? 'выбрано' : delta(d)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {changed.length > 0 && prev && (
                <p class="conf__changed" role="status">
                  Было {prev.name}. Вместе с выбором поменялось: {changed.join(', ')}.
                </p>
              )}
              {(box.added.size > 0 || box.removed.length > 0) && (
                <p class="conf__note">
                  В коробке {box.added.size > 0 && <>добавилось: {[...box.added].join(', ')}</>}
                  {box.added.size > 0 && box.removed.length > 0 && '; '}
                  {box.removed.length > 0 && <>убрано: {box.removed.join(', ')}</>}.{' '}
                  <button type="button" class="linkbtn" onClick={() => { setTab('box'); document.getElementById('tabs')?.scrollIntoView({ behavior: 'smooth' }); }}>Смотреть</button>
                </p>
              )}
              <p class="conf__note">* – этого сочетания нет: перейдём на ближайший вариант, наведите на кнопку, чтобы увидеть, что ещё поменяется.</p>
              <details>
                <summary class="linkbtn">Все варианты серии списком</summary>
                <div class="conf__opts">
                  {others.map((m) => (
                    <button type="button" class="opt" aria-pressed={m.slug === p.slug} onClick={() => go(m, [])}>
                      <span class="opt__label">{m.name.replace('StarLine ', '')}</span>
                      <span class="opt__delta">{rub(m.price)}</span>
                    </button>
                  ))}
                </div>
              </details>
            </section>
          )}
        </div>
      </div>

      <div class="tabs" id="tabs" role="tablist" aria-label="О товаре">
        {tabs.map((t) => (
          <button type="button" role="tab" class="tab" id={`tab-${t.key}`} aria-selected={tab === t.key} aria-controls="tabpanel"
            onClick={() => setTab(t.key)}>
            {t.title}{t.n !== undefined && <span class="tab__n">{t.n}</span>}
          </button>
        ))}
      </div>

      <div id="tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`} class="swap" key={tab + p.slug}>
        {tab === 'features' && p.features.map((g) => (
          <section class="feat-group">
            <h2>{g.title}</h2>
            <ul class="feat-list">
              {g.items.map((f) => (
                <li class="feat">
                  {f.icon && <img class="feat__icon" src={base + f.icon} alt="" width={40} height={40} loading="lazy" />}
                  <div><p class="feat__title">{f.title}</p><p class="feat__text">{f.text}</p></div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {tab === 'box' && (
          <>
            <ul class="box">
              {p.equipment.map((e) => (
                <li class={`box__item${box.added.has(e.title) ? ' box__item--new' : ''}`}>
                  {box.added.has(e.title) && <span class="box__badge">Добавилось</span>}
                  <div class="box__img">{e.img && <img src={base + e.img} alt="" width={240} height={180} loading="lazy" />}</div>
                  <span class="box__title">{e.title}</span>
                </li>
              ))}
            </ul>
            {box.removed.length > 0 && prev && (
              <p class="box__gone">Было в {prev.name}, здесь нет: {box.removed.map((t, i) => <>{i > 0 && ', '}<s>{t}</s></>)}</p>
            )}
          </>
        )}

        {tab === 'docs' && (
          <ul class="docs">
            {p.docs.map((d) => <li><a href={d.href} target="_blank" rel="noopener">{d.title}</a></li>)}
          </ul>
        )}

        {tab === 'warranty' && <p class="prose">{p.warranty}</p>}
      </div>
    </>
  );
}
