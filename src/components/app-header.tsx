import { Link, useRouter } from "@tanstack/react-router";
import { LogOut, Sparkles, Settings, Bell, LayoutGrid, Heart, Globe, Check } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCountry, COUNTRIES } from "@/hooks/use-country";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function AppHeader() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { country, setCountry } = useCountry();
  const [notifications, setNotifications] = useState(true);
  const [countryOpen, setCountryOpen] = useState(false);

  const photo =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    null;
  const email = user?.email ?? "";
  const initial = (user?.user_metadata?.name || email || "?").trim().charAt(0).toUpperCase();

  const navLinkClass =
    "relative flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-muted-foreground hover:bg-white/60 hover:text-foreground transition";
  const navLinkActive =
    "relative flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-white/80 text-[var(--primary)] shadow-sm font-semibold";

  return (
    <header className="sticky top-0 z-40 w-full overflow-x-hidden px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="glass-strong mx-auto grid w-full max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-2 rounded-full px-3 py-2 sm:gap-3 sm:px-5 sm:py-3">
        {/* Left: logo */}
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 justify-self-start font-display text-sm font-semibold tracking-tight sm:text-base"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl overflow-hidden shadow-md">
            <img src="/icon-192.png" alt="Price Tube" className="h-full w-full object-cover" />
          </span>
          <span className="text-gradient whitespace-nowrap hidden min-[360px]:inline">Price Tube</span>
        </Link>

        {/* Center: nav */}
        <nav className="flex items-center gap-0.5 justify-self-center sm:gap-1">
          {user && (
            <>
              <Link
                to="/app"
                className={navLinkClass}
                activeProps={{ className: navLinkActive }}
                aria-label="Dashboard"
              >
                <LayoutGrid className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <Link
                to="/app/wishlist"
                className={navLinkClass}
                activeProps={{ className: navLinkActive }}
                aria-label="Wishlist"
              >
                <Heart className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">Wishlist</span>
              </Link>
            </>
          )}
        </nav>


        {/* Right: profile */}
        <div className="flex items-center gap-2 justify-self-end">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient text-xs font-semibold text-primary-foreground shadow-md ring-2 ring-white/70 transition hover:scale-105"
                  aria-label="Open profile menu"
                >
                  {photo ? (
                    <img src={photo} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span>{initial}</span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={10}
                className="glass-strong w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl border-white/40 p-2"
              >
                <div className="flex items-center gap-3 rounded-xl glass-inset px-3 py-2.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient text-sm font-semibold text-primary-foreground">
                    {photo ? (
                      <img src={photo} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span>{initial}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{user.user_metadata?.name ?? "Account"}</div>
                    <div className="truncate text-xs text-muted-foreground">{email}</div>
                  </div>
                </div>

                <DropdownMenuSeparator className="my-2 bg-white/50" />

                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setCountryOpen(true);
                  }}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm focus:bg-white/70"
                >
                  <span className="flex min-w-0 items-center">
                    <Globe className="mr-2 h-4 w-4 shrink-0 text-[var(--primary)]" />
                    Country
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{country ?? "Not set"}</span>
                </DropdownMenuItem>

                <DropdownMenuItem className="rounded-lg px-3 py-2 text-sm focus:bg-white/70">
                  <Settings className="mr-2 h-4 w-4 text-[var(--primary)]" />
                  Preferences
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setNotifications((v) => !v);
                  }}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm focus:bg-white/70"
                >
                  <span className="flex items-center">
                    <Bell className="mr-2 h-4 w-4 text-[var(--primary)]" />
                    Notifications
                  </span>
                  <span
                    role="switch"
                    aria-checked={notifications}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                      notifications ? "bg-brand-gradient" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                        notifications ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-2 bg-white/50" />

                <DropdownMenuItem
                  onSelect={async () => {
                    await signOut();
                    router.navigate({ to: "/" });
                  }}
                  className="rounded-lg px-3 py-2 text-sm text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-md hover:shadow-lg transition sm:px-4"
            >
              <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sign in</span>
            </Link>
          )}
        </div>
      </div>

      <Dialog open={countryOpen} onOpenChange={setCountryOpen}>
        <DialogContent className="glass-strong w-[calc(100vw-1.5rem)] max-w-md overflow-x-hidden rounded-3xl border-white/40 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Country preference</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              We'll tailor product searches to retailers in your country.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            {COUNTRIES.map((c) => {
              const selected = country === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={async () => {
                    await setCountry(c);
                    setCountryOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition ${
                    selected ? "bg-brand-gradient text-primary-foreground" : "glass-inset hover:bg-white/70"
                  }`}
                >
                  <span className="truncate">{c}</span>
                  {selected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
          {country && (
            <button
              type="button"
              onClick={async () => {
                await setCountry(null);
                setCountryOpen(false);
              }}
              className="mt-2 rounded-xl glass-inset px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear country preference
            </button>
          )}
        </DialogContent>
      </Dialog>
    </header>
  );
}
