// Страница сравнения: таблица «параметр × товар», режим «только различия», быстрые подборки и ссылка на сравнение.
import { useEffect, useState } from 'preact/hooks';
import { AXES, cell, type Attrs, type ParamSection, type ParamValue } from '../lib/catalog';
import { COMPARE_MAX, toggleCompare, useCompare, writeCompare } from '../lib/compare';

export interface CmpItem {
  slug: string; name: string; price: number; image: string | null; familyTitle: string;
  attrs: Attrs; params: Record<string, ParamValue>;
}
interface Props {
  items: CmpItem[];
  sections: ParamSection[];
  presets: { title: string; slugs: string[] }[];
  base: string;
}

interface Row { key: string; title: string; desc?: string; icon?: string | null; values: { kind: string; text: string }[] }

const rub = (n: number) => n.toLocaleString('ru-RU') + ' ₽';

export default function CompareTable({ items, sections, presets, base }: Props) {
  const list = useCompare();
  const [diffOnly, setDiffOnly] = useState(false);
  const [copied, setCopied] = useState(false);

  // ?ids=a,b,c – открыть присланное сравнение
  useEffect(() => {
    const ids = new URLSearchParams(location.search).get('ids');
    if (!ids) return;
    const valid = ids.split(',').filter((s) => items.some((i) => i.slug === s)).slice(0, COMPARE_MAX);
    if (valid.length) writeCompare(valid);
    history.replaceState(null, '', location.pathname);
  }, []);

  const chosen = list.map((s) => items.find((i) => i.slug === s)).filter((i): i is CmpItem => !!i);

  if (chosen.length === 0) {
    return (
      <div class="empty">
        <p>В сравнении пока пусто. Добавьте товары кнопкой со столбиками в каталоге или начните с готовой подборки:</p>
        <div class="chips">
          {presets.map((p) => (
            <button type="button" class="chip" onClick={() => writeCompare(p.slugs.slice(0, COMPARE_MAX))}>{p.title}</button>
          ))}
        </div>
        <p />
        <a class="btn btn--primary" href={base}>Перейти в каталог</a>
      </div>
    );
  }

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: 'Главное',
      rows: [
        { key: 'price', title: 'Цена', values: chosen.map((p) => ({ kind: 'text', text: rub(p.price) })) },
        ...AXES.map((a) => ({
          key: a.key, title: a.title, desc: a.hint,
          values: chosen.map((p) => {
            const v = p.attrs[a.key];
            const off = v === false || v === 0 || v === 'нет' || v === 'опция';
            return { kind: off ? 'no' : 'text', text: a.label(v) };
          }),
        })),
      ],
    },
    ...sections.map((s) => ({
      title: s.title,
      rows: s.props.map((pr) => ({ key: pr.key, title: pr.title, desc: pr.desc, icon: pr.icon, values: chosen.map((p) => cell(p.params[pr.key])) })),
    })),
  ];
  const differs = (r: Row) => new Set(r.values.map((v) => v.kind + v.text)).size > 1;
  const nDiff = groups.reduce((n, g) => n + g.rows.filter(differs).length, 0);

  const share = async () => {
    const url = `${location.origin}${location.pathname}?ids=${chosen.map((p) => p.slug).join(',')}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt('Ссылка на сравнение', url);
    }
  };

  return (
    <>
      <div class="cmp-bar">
        <div class="seg" role="group" aria-label="Какие параметры показывать">
          <button type="button" aria-pressed={!diffOnly} onClick={() => setDiffOnly(false)}>Все параметры</button>
          <button type="button" aria-pressed={diffOnly} onClick={() => setDiffOnly(true)}>Только различия · {nDiff}</button>
        </div>
        <div class="toolbar__right">
          <button type="button" class="linkbtn" onClick={share}>{copied ? 'Ссылка скопирована' : 'Поделиться'}</button>
          <button type="button" class="linkbtn" onClick={() => writeCompare([])}>Очистить</button>
        </div>
      </div>

      <div class="cmp-scroll">
        <table class="cmp-table">
          <thead>
            <tr>
              <th scope="col"><span class="muted">{chosen.length} из {COMPARE_MAX}</span></th>
              {chosen.map((p) => (
                <th scope="col" key={p.slug}>
                  <div class="cmp-head">
                    <a class="cmp-head__img" href={`${base}catalog/${p.slug}/`} tabIndex={-1} aria-hidden="true">
                      {p.image && <img src={base + p.image} alt="" width={200} height={150} />}
                    </a>
                    <a class="cmp-head__name" href={`${base}catalog/${p.slug}/`}>{p.name}</a>
                    <div class="cmp-head__row">
                      <span class="price">{rub(p.price)}</span>
                      <button type="button" class="cmp-toggle" aria-label={`Убрать ${p.name} из сравнения`}
                        title="Убрать из сравнения" onClick={() => toggleCompare(p.slug)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const rows = g.rows.filter((r) => !diffOnly || differs(r));
              if (!rows.length) return null;
              return [
                <tr class="cmp-sec" key={g.title}><th scope="rowgroup" colSpan={chosen.length + 1}>{g.title}</th></tr>,
                ...rows.map((r) => (
                  <tr key={g.title + r.key} class={!diffOnly && chosen.length > 1 && differs(r) ? 'cmp-row--diff' : undefined}>
                    <th scope="row" title={r.desc}>
                      <span class="cmp-param">
                        {r.icon && <img src={base + r.icon} alt="" width={28} height={28} loading="lazy" />}
                        <span>{r.title}</span>
                      </span>
                    </th>
                    {r.values.map((v, i) => <td key={chosen[i].slug}><span class={`val val--${v.kind}`}>{v.text}</span></td>)}
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
      {chosen.length < COMPARE_MAX && (
        <p class="conf__note">Можно добавить ещё {COMPARE_MAX - chosen.length} – <a href={base}>в каталог</a>. Подсвечены строки, где товары отличаются.</p>
      )}
    </>
  );
}
