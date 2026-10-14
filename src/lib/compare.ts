// Список сравнения: slug-и товаров в localStorage, изменения расходятся событием по всем островам и вкладкам.
import { useEffect, useState } from 'preact/hooks';

const KEY = 'sl-compare';
const EVENT = 'sl-compare';
export const COMPARE_MAX = 6;

export function readCompare(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function writeCompare(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* приватный режим: сравнение живёт до перезагрузки */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: list }));
}

/** Добавить/убрать товар. false – если список уже полон и добавить нельзя. */
export function toggleCompare(slug: string): boolean {
  const list = readCompare();
  if (list.includes(slug)) {
    writeCompare(list.filter((s) => s !== slug));
    return true;
  }
  if (list.length >= COMPARE_MAX) return false;
  writeCompare([...list, slug]);
  return true;
}

/** Хук для островов: текущий список сравнения, обновляется при любых изменениях. */
export function useCompare(): string[] {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setList(readCompare());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return list;
}
