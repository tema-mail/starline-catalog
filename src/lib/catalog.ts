// Данные каталога и логика комплектаций. Источник – src/data/catalog.json (собирает scripts/build_data.py).
import raw from '../data/catalog.json';

export type ParamValue = boolean | string;

export interface Attrs {
  autostart: boolean;
  bt: boolean;
  tags: number;
  fob: string;
  can: string;
  link: string;
  gps: boolean;
  relay: string;
  gen: string;
}

export interface Feature { title: string; text: string; icon: string | null }
export interface FeatureGroup { title: string; items: Feature[] }
export interface EquipmentItem { title: string; img: string | null }

export interface Product {
  slug: string;
  id: string;
  name: string;
  type: string;
  lead: string;
  price: number;
  family: string;
  image: string | null;
  gallery: string[];
  funcs: string[];
  attrs: Attrs;
  params: Record<string, ParamValue>;
  features: FeatureGroup[];
  equipment: EquipmentItem[];
  docs: { href: string; title: string }[];
  warranty: string;
}

export interface Family { key: string; title: string; desc: string; members: string[] }
export interface Filter { key: string; title: string; hint: string }
export interface Param { key: string; title: string; desc: string; icon: string | null }
export interface ParamSection { title: string; props: Param[] }

export interface Catalog {
  updated: string;
  source: string;
  filters: Filter[];
  families: Family[];
  params: ParamSection[];
  products: Product[];
}

export const catalog = raw as Catalog;

export const bySlug = (slug: string) => catalog.products.find((p) => p.slug === slug);
export const familyOf = (p: Product) => catalog.families.find((f) => f.key === p.family)!;
export const membersOf = (f: Family) => f.members.map((s) => bySlug(s)!);

export const rub = (n: number) => n.toLocaleString('ru-RU') + ' ₽';

// ── Оси комплектации ─────────────────────────────────────
// Порядок осей = порядок блоков в конфигураторе. weight – насколько дорого менять ось при подборе ближайшей комплектации.
type AxisKey = keyof Attrs;
export interface Axis { key: AxisKey; title: string; weight: number; label: (v: Attrs[AxisKey]) => string; hint?: string }

export const AXES: Axis[] = [
  { key: 'gen', title: 'Поколение', weight: 6, label: (v) => (v === 'v3' ? 'A63 / A93 v3' : v === 'v2' ? 'A60 / A90' : '—'),
    hint: 'v3 – новее: обход иммобилайзера, управление по Bluetooth со смартфона' },
  { key: 'autostart', title: 'Автозапуск', weight: 5, label: (v) => (v ? 'С автозапуском' : 'Без автозапуска'),
    hint: 'Запуск двигателя по времени, температуре или со смартфона' },
  { key: 'tags', title: 'Метки', weight: 3, label: (v) => (v === 0 ? 'Без метки' : v === 1 ? '1 метка' : '2 метки'),
    hint: 'Без метки рядом машина не поедет – защита от угона с ключом' },
  { key: 'bt', title: 'Bluetooth', weight: 3, label: (v) => (v ? 'Bluetooth' : 'Без Bluetooth'),
    hint: 'Управление со смартфона рядом с машиной и авторизация по метке' },
  { key: 'fob', title: 'Брелок', weight: 3, label: (v) => (v === 'нет' ? 'Без брелока' : String(v)) },
  { key: 'can', title: 'Цифровая шина', weight: 4, label: (v) => (v === 'нет' ? 'Без CAN' : String(v)),
    hint: 'Подключение к штатной электронике и скрытая блокировка по CAN' },
  { key: 'link', title: 'Связь', weight: 2, label: (v) => (v === 'нет' ? 'Без GSM' : v === '4G' ? '4G LTE' : String(v)),
    hint: 'GSM/4G – управление из приложения откуда угодно; LoRa – дальняя радиосвязь' },
  { key: 'gps', title: 'GPS', weight: 2, label: (v) => (v ? 'GPS+ГЛОНАСС' : 'Без GPS'),
    hint: 'Точное местоположение машины в приложении' },
  { key: 'relay', title: 'Реле блокировки', weight: 1, label: (v) => (v === 'нет' ? 'Без реле' : String(v)) },
];

export interface AxisOption { value: Attrs[AxisKey]; label: string; target: Product; exact: boolean; changes: string[] }
export interface AxisView { axis: Axis; options: AxisOption[] }

const same = (a: unknown, b: unknown) => a === b;

// Порядок значений внутри оси: «нет» первым, дальше от простого к богатому.
const ORDER = ['нет', 'v2', 'v3', 'GSM', '4G', 'LoRa', '2CAN+2LIN', '2CAN+4LIN', '3CAN+FD+4LIN', 'ЖК-брелок', 'ЖК-брелок + доп.', 'BT-брелок'];
const rank = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : ORDER.indexOf(String(v)) + 1 || 99);

/** Отличия b от a по осям (кроме оси skip) – подписи «было → стало». */
function diff(a: Product, b: Product, skip: AxisKey): string[] {
  return AXES.filter((x) => x.key !== skip && !same(a.attrs[x.key], b.attrs[x.key])).map(
    (x) => `${x.label(a.attrs[x.key])} → ${x.label(b.attrs[x.key])}`,
  );
}

/** Ближайшая комплектация семейства с значением value на оси axis: меньше сменённых осей, потом ближе по цене. */
export function resolve(current: Product, members: Product[], axis: Axis, value: Attrs[AxisKey]): Product | undefined {
  const cost = (p: Product) =>
    AXES.reduce((s, x) => s + (x.key !== axis.key && !same(p.attrs[x.key], current.attrs[x.key]) ? x.weight : 0), 0);
  return members
    .filter((p) => same(p.attrs[axis.key], value))
    .sort((a, b) => cost(a) - cost(b) || Math.abs(a.price - current.price) - Math.abs(b.price - current.price))[0];
}

/** Оси, по которым в семействе есть выбор, с вариантами и куда ведёт каждый. */
export function configurator(current: Product, members: Product[]): AxisView[] {
  return AXES.map((axis) => {
    const values = [...new Set(members.map((p) => p.attrs[axis.key]))].sort((a, b) => rank(a) - rank(b));
    const options = values.map((value) => {
      const target = same(value, current.attrs[axis.key]) ? current : resolve(current, members, axis, value)!;
      const changes = diff(current, target, axis.key);
      return { value, label: axis.label(value), target, exact: changes.length === 0, changes };
    });
    return { axis, options };
  }).filter((v) => v.options.length > 1);
}

// ── Значение параметра для сравнения ──────────────────────
export type Cell = { kind: 'yes' | 'no' | 'option' | 'text'; text: string };
export function cell(v: ParamValue | undefined): Cell {
  if (v === true) return { kind: 'yes', text: 'Есть' };
  if (v === 'опция') return { kind: 'option', text: 'Опция' };
  if (!v) return { kind: 'no', text: 'Нет' };
  return { kind: 'text', text: v };
}
