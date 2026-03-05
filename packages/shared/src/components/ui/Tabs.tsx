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
}

const sizeClasses: Record<Size, string> = {
  default: 'px-4 py-2 text-sm',
  sm: 'px-3 py-1.5 text-xs',
};

export function Tabs({ tabs, activeTab, onTabChange, size = 'default' }: TabsProps) {
  return (
    <div className="flex border-b select-none">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`font-medium ${sizeClasses[size]} ${
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
  );
}
