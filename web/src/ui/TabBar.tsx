import { Bookmark, Compass, House, Tv } from 'lucide-react';
import type { Tab } from '../nav';

const TABS: { tab: Tab; label: string; Icon: typeof House }[] = [
  { tab: 'home', label: 'Home', Icon: House },
  { tab: 'discover', label: 'Discover', Icon: Compass },
  { tab: 'live', label: 'Live', Icon: Tv },
  { tab: 'me', label: 'My Space', Icon: Bookmark },
];

/** Floating glass pill navigation; the active tab stretches open to show its label. */
export function TabBar({ selected, onSelect }: { selected: Tab; onSelect: (t: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ tab, label, Icon }) => (
        <button key={tab} className={tab === selected ? 'on' : ''} onClick={() => onSelect(tab)} aria-label={label} aria-current={tab === selected ? 'page' : undefined}>
          <Icon size={22} />
          <span className="label">
            <span>{label}</span>
          </span>
        </button>
      ))}
    </nav>
  );
}
