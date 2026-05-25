import { Link, useRouter } from "@tanstack/react-router";
import { Droplets, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function AppHeader() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 px-4 pt-4">
      <div className="glass-strong mx-auto flex max-w-6xl items-center justify-between rounded-full px-5 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] text-primary-foreground shadow-md">
            <Droplets className="h-4 w-4" />
          </span>
          <span className="text-gradient">Frost</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {user ? (
            <>
              <Link
                to="/app"
                className="rounded-full px-4 py-1.5 text-sm text-muted-foreground hover:bg-white/40 hover:text-foreground transition"
                activeProps={{ className: "rounded-full px-4 py-1.5 text-sm bg-white/60 text-foreground" }}
              >
                Dashboard
              </Link>
              <Link
                to="/app/wishlist"
                className="rounded-full px-4 py-1.5 text-sm text-muted-foreground hover:bg-white/40 hover:text-foreground transition"
                activeProps={{ className: "rounded-full px-4 py-1.5 text-sm bg-white/60 text-foreground" }}
              >
                Wishlist
              </Link>
            </>
          ) : (
            <Link
              to="/"
              className="rounded-full px-4 py-1.5 text-sm text-muted-foreground hover:bg-white/40 hover:text-foreground transition"
            >
              Home
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <button
              onClick={async () => {
                await signOut();
                router.navigate({ to: "/" });
              }}
              className="flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white/90 transition shadow-sm"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-4 py-1.5 text-xs font-medium text-primary-foreground shadow-md hover:shadow-lg transition"
            >
              <Sparkles className="h-3.5 w-3.5" /> Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
