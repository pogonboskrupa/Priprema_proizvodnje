"use client";
import { Icon } from "@/components/Icon";

// Fiksno ime fajla na zadnjem GitHub Release-u (pravi ga .github/workflows/build-apk.yml)
const APK_URL = "https://github.com/pogonboskrupa/Priprema_proizvodnje/releases/latest/download/priprema-proizvodnje.apk";

/** Preuzimanje Android aplikacije; APK učitava live verziju pa ga ne treba često mijenjati */
export function ApkPreuzimanje() {
  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex flex-wrap items-center gap-4">
      <span aria-hidden className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400">
        <Icon name="download" className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-gray-700 dark:text-gray-200">Android aplikacija</h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Preuzmi APK i otvori ga na telefonu; dozvoli instalaciju iz nepoznatih izvora. Aplikacija uvijek učitava najnoviju verziju.
        </p>
      </div>
      <a href={APK_URL} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">
        <Icon name="download" className="h-4 w-4" />
        Preuzmi APK
      </a>
    </section>
  );
}
