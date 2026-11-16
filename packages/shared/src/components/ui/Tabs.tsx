import { useRef } from 'react';
import { tabNavigationTarget } from './keyboard-logic';

interface Tab {
  id: string;
  label: string;
}

type Size = 'default' | 'sm';

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  size?: Size;
  /** Base id: tabs get `${id}-tab-${tab.id}`; the panel must be `${id}-panel` with `role="tabpanel"`. */
  id: string;
  /** Accessible name of the tab list. */
  label?: string;
  /** Extra content after the tabs (right-aligned by the caller). */
  children?: React.ReactNode;
}

const sizeClasses: Record<Size, string> = {
  default: 'px-4 py-2 text-sm',
  sm: 'px-3 py-1.5 text-xs',
};

/** Tab list with the ARIA tabs pattern: roving tabindex, arrow keys, Home/End. */
export function Tabs({ tabs, activeTab, onTabChange, size = 'default', id, label, children }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const index = tabs.findIndex((tab) => tab.id === activeTab);
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const next = tabNavigationTarget(e.key, index, tabs.length, rtl);
    if (next === null) return;
    e.preventDefault();
    const nextTab = tabs[next];
    if (!nextTab) return;
    onTabChange(nextTab.id);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div className="flex items-stretch border-b select-none overflow-x-auto">
      {/* Roving tabindex: focus lives on the tabs, not on the tablist. */}
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
      <div ref={listRef} role="tablist" aria-label={label} className="flex" onKeyDown={handleKeyDown}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${id}-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`${id}-panel`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`font-medium whitespace-nowrap pointer-coarse:min-h-11 ${sizeClasses[size]} ${
              activeTab === tab.id
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
