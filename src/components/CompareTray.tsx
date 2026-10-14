// Лоток сравнения внизу экрана + счётчик в шапке. Виден, пока в сравнении есть товары.
import { useEffect } from 'preact/hooks';
import { COMPARE_MAX, toggleCompare, useCompare, writeCompare } from '../lib/compare';

interface Props { items: { slug: string; name: string; image: string | null }[]; base: string; hide?: boolean }

export default function CompareTray({ items, base, hide }: Props) {
  const list = useCompare();
  const chosen = list.map((s) => items.find((i) => i.slug === s)).filter((i) => !!i);
  const show = !hide && chosen.length > 0;

  useEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-cmp-count]').forEach((el) => {
      el.textContent = String(chosen.length);
      el.hidden = chosen.length === 0;
    });
    document.body.classList.toggle('has-tray', show);
  }, [chosen.length, show]);

  if (!show) return null;
  return (
    <aside class="tray" aria-label="Сравнение">
      <div class="tray__in">
        <span class="tray__label">{chosen.length} из {COMPARE_MAX}</span>
        <div class="tray__items">
          {chosen.map((i) => (
            <div class="tray__item" key={i.slug} title={i.name}>
              {i.image && <img src={base + i.image} alt={i.name} width={44} height={44} />}
              <button type="button" class="tray__x" aria-label={`Убрать ${i.name}`} onClick={() => toggleCompare(i.slug)}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" class="linkbtn" onClick={() => writeCompare([])}>Очистить</button>
        <a class="btn btn--primary" href={`${base}compare/`}>Сравнить</a>
      </div>
    </aside>
  );
}
