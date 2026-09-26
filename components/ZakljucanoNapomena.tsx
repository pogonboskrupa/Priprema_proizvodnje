import { Icon } from "@/components/Icon";

export function ZakljucanoNapomena({ tekst = "Mjesec je zaključan — izmjene može napraviti samo admin." }: { tekst?: string }) {
  return (
    <div role="note" className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
      <Icon name="lock" className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
      {tekst}
    </div>
  );
}
