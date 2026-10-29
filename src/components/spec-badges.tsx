/** Quiet variant pills: Official/Unofficial, RAM/storage, out of stock. */
export type Specs = { official: "Official" | "Unofficial" | null; memory: string | null };

export function parseSpecs(...texts: (string | null | undefined)[]): Specs {
  const t = texts.filter(Boolean).join(" ");
  const official = /\bunofficial\b/i.test(t) ? "Unofficial" : /\bofficial\b/i.test(t) ? "Official" : null;
  let memory: string | null = null;
  const pair = t.match(/\b(\d{1,2})\s*(?:gb)?\s*[/+|-]\s*(\d{2,4}|1)\s*(gb|tb)\b/i);
  if (pair) memory = `${pair[1]}/${pair[2]}${pair[3].toUpperCase() === "TB" ? " TB" : " GB"}`;
  else {
    const ram = t.match(/\b(\d{1,2})\s*gb\s*ram\b/i);
    const rom = t.match(/\b(64|128|256|512|1)\s*(gb|tb)\b(?!\s*ram)/i);
    if (ram && rom) memory = `${ram[1]}/${rom[1]} ${rom[2].toUpperCase()}`;
    else if (rom) memory = `${rom[1]} ${rom[2].toUpperCase()}`;
  }
  return { official, memory };
}

const base = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-4";

export function SpecBadges({ title, description, inStock }: { title?: string | null; description?: string | null; inStock?: boolean }) {
  const s = parseSpecs(title, description);
  if (!s.official && !s.memory && inStock !== false) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {s.official && (
        <span className={`${base} ${s.official === "Official" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{s.official}</span>
      )}
      {s.memory && <span className={`${base} bg-muted text-foreground`}>{s.memory}</span>}
      {inStock === false && <span className={`${base} bg-destructive/10 text-destructive`}>Out of stock</span>}
    </div>
  );
}
