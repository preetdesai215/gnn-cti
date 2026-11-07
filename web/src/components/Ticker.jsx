// Scrolling strip of recent alerts. The items are rendered twice so the loop joins up seamlessly.
// Hovering pauses it, so a line can be read.
export default function Ticker({ items, emptyText }) {
  if (!items || items.length === 0) {
    return (
      <div className="glass flex items-center gap-3 px-4 py-2.5 text-xs text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
        {emptyText}
      </div>
    );
  }

  const row = (
    <div className="flex shrink-0">
      {items.map((text, i) => (
        <span key={i} className="flex shrink-0 items-center gap-3 whitespace-nowrap pr-10">
          <span className="text-accent-light">◆</span>
          {text}
        </span>
      ))}
    </div>
  );

  return (
    <div className="ticker glass overflow-hidden py-2.5 font-mono text-xs text-slate-300" role="region" aria-label="Recent alerts">
      <div className="ticker-track flex w-max">
        {row}
        <div aria-hidden="true" className="flex">{row}</div>
      </div>
    </div>
  );
}
