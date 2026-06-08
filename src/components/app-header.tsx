import { Link, useRouter } from "@tanstack/react-router";
import { Droplets, LogOut, Sparkles, Settings, Bell } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState(true);

  const photo =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    null;
  const email = user?.email ?? "";
  const initial = (user?.user_metadata?.name || email || "?").trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 px-4 pt-4">
      <div className="glass-strong mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-full px-5 py-3">
        {/* Left: logo */}
        <Link to="/" className="flex items-center gap-2 justify-self-start font-display text-base font-semibold tracking-tight">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient text-primary-foreground shadow-md">
            <Droplets className="h-4 w-4" />
          </span>
          <span className="text-gradient">Price Tube</span>
        </Link>

        {/* Center: nav */}
        <nav className="hidden items-center gap-1 justify-self-center sm:flex">
          <Link
            to="/search"
            className="rounded-full px-4 py-1.5 text-sm text-muted-foreground hover:bg-white/60 hover:text-foreground transition"
            activeProps={{ className: "rounded-full px-4 py-1.5 text-sm bg-white/70 text-foreground" }}
          >
            Search
          </Link>
          {user && (
            <>
              <Link
                to="/app"
                className="rounded-full px-4 py-1.5 text-sm text-muted-foreground hover:bg-white/60 hover:text-foreground transition"
                activeProps={{ className: "rounded-full px-4 py-1.5 text-sm bg-white/70 text-foreground" }}
              >
                Dashboard
              </Link>
              <Link
                to="/app/wishlist"
                className="rounded-full px-4 py-1.5 text-sm text-muted-foreground hover:bg-white/60 hover:text-foreground transition"
                activeProps={{ className: "rounded-full px-4 py-1.5 text-sm bg-white/70 text-foreground" }}
              >
                Wishlist
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
                  className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-brand-gradient text-xs font-semibold text-primary-foreground shadow-md ring-2 ring-white/70 transition hover:scale-105"
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
                className="glass-strong w-64 rounded-2xl border-white/40 p-2"
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
              className="flex items-center gap-1.5 rounded-full bg-brand-gradient px-4 py-1.5 text-xs font-medium text-primary-foreground shadow-md hover:shadow-lg transition"
            >
              <Sparkles className="h-3.5 w-3.5" /> Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
