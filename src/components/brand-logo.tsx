/** Price Tag squircle mark. The icon file has a transparent margin, so it's scaled to fill the rounded frame. */
export function BrandLogo({ size = 32 }: { size?: number }) {
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden shadow-md"
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <img src="/icon-192.png" alt="Price Tag" width={size} height={size} className="h-full w-full scale-[1.16] object-cover" />
    </span>
  );
}
