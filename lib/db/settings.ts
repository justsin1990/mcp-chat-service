import { supabase } from "@/lib/supabase";

export async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) throw error;
  return data?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from("user_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
}
