import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const COUNTRIES = [
  "Bangladesh",
  "India",
  "Pakistan",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Japan",
  "Singapore",
  "United Arab Emirates",
  "Saudi Arabia",
  "Malaysia",
  "Indonesia",
  "Philippines",
] as const;

export function useCountry() {
  const { user } = useAuth();
  const [country, setCountryState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setCountryState(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("profiles")
      .select("country")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setCountryState(((data as any)?.country as string | null) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setCountry = useCallback(
    async (value: string | null) => {
      if (!user) return;
      setCountryState(value);
      await supabase
        .from("profiles")
        .update({ country: value } as any)
        .eq("user_id", user.id);
    },
    [user],
  );

  return { country, setCountry, loading };
}
