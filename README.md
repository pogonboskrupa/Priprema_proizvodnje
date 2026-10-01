# Priprema Proizvodnje

Web/PWA i Android aplikacija za evidenciju rada u pripremi šumske proizvodnje: doznaka, vlake, terenski i kancelarijski rad, godišnji odmor, bolovanje, planovi i izvještaji po projektantu i odjelu.

## Tehnologije

- Next.js 16, React 19 i TypeScript
- Firebase Authentication i Firestore s offline cacheom
- Tailwind CSS 4
- Capacitor 8 za Android omotač
- GitHub Pages i GitHub Actions

## Lokalni razvoj

Potrebni su Node.js 20+ i npm.

```bash
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Popunite `.env.local` vrijednostima iz Firebase projekta. Datoteke `.env*` s tajnama ne smiju se commitati.

## Provjere kvalitete

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Sve provjere zajedno:

```bash
npm run check
```

Testovi pokrivaju pravila dnevnih unosa, godišnji odmor, zaključavanje mjeseci, parsiranje brojčanih vrijednosti i kalendarsku rekapitulaciju.

## Produkcijski build

Aplikacija koristi statički Next.js export. Za GitHub Pages:

```bash
$env:NEXT_PUBLIC_BASE_PATH = "/Priprema_proizvodnje"
npm run build
```

Rezultat se generira u `out/`. Ta mapa, kao i raniji `docs/` build artefakti, nije dio izvornog koda. GitHub Actions objavljuje `out/` direktno kao Pages artefakt.

## Verzija i Android

Jedini izvor verzije je polje `version` u `package.json`. Web prikaz, Android `versionName`, Android `versionCode` i naziv GitHub Releasea izvode se iz te vrijednosti.

Android aplikacija učitava objavljenu GitHub Pages verziju. Potpisani APK nastaje u workflowu `Build Android APK` i objavljuje se kroz GitHub Releases; APK datoteke se ne spremaju u repozitorij.

Potrebni GitHub Actions secrets:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (opcionalno)
- `ANDROID_KEYSTORE_B64`
- `ANDROID_KEY_PASS`
- `ANDROID_STORE_PASS`

## Git tijek rada

`main` je produkcijska grana. Promjene se rade u zasebnom branchu i spajaju pull requestom nakon prolaska TypeScript, lint i test provjera. Deployment se pokreće samo za `main`.

## Struktura

- `app/` — stranice i globalni stilovi
- `components/` — zajedničke UI komponente
- `hooks/` — React hookovi
- `lib/` — poslovna pravila, Firebase pristup, izvještaji i izvoz
- `tests/` — Vitest testovi poslovnih pravila
- `android/` — Capacitor Android projekt
- `.github/workflows/` — CI, Pages deployment i APK release

Promjene po verzijama nalaze se u [CHANGELOG.md](CHANGELOG.md).
