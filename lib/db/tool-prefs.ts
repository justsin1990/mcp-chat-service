import { supabase } from "@/lib/supabase";

interface ToolPrefs {
  [key: string]: boolean;
}

export async function fetchToolPrefs(): Promise<ToolPrefs> {
  const { data, error } = await supabase.from("tool_prefs").select("*");

  if (error) throw error;

  const prefs: ToolPrefs = {};
  for (const row of data ?? []) {
    prefs[row.key as string] = row.enabled as boolean;
  }
  return prefs;
}

export async function upsertToolPrefs(prefs: ToolPrefs): Promise<void> {
  const rows = Object.entries(prefs).map(([key, enabled]) => ({ key, enabled }));

  await supabase.from("tool_prefs").delete().neq("key", "");

  if (rows.length > 0) {
    const { error } = await supabase.from("tool_prefs").upsert(rows, { onConflict: "key" });
    if (error) throw error;
  }
}
