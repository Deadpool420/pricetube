import { useEffect, useState } from "react";
import { Package } from "lucide-react";

/** Image that falls back to a neutral icon tile instead of a broken-image icon. */
export function SafeImage({
  src,
  alt = "",
  className = "h-full w-full object-contain",
  iconClassName = "h-6 w-6",
}: {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <div className="grid h-full w-full place-items-center rounded-[inherit] text-muted-foreground">
        <Package className={iconClassName} />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} loading="lazy" />;
}
