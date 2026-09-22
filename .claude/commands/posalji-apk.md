# Pošalji APK na Priprema Proizvodnje

Izvršava se kad korisnik kaže "pošalji apk na pp", "/posalji-apk", "apk je spreman" ili slično.

## Koraci

1. **Provjeri `public/app-release.apk` u repozitoriju**
   - Pročitaj prvih 4 bajta: pravi APK počinje sa `PK` (ZIP magic bytes, hex `50 4B 03 04`)
   - Provjeri veličinu: mora biti > 50 000 bajta (> ~50 KB), inače je placeholder
   - Koristi: `git cat-file -s HEAD:public/app-release.apk` za veličinu
   - Koristi: `head -c 4 public/app-release.apk | od -An -tx1` za magic bytes

2. **Ako je fajl validan APK** (`PK` magic bytes + veličina > 50 KB):
   - Pročitaj `app/postavke/page.tsx`
   - Postavi `APK_AVAILABLE = true`
   - Ažuriraj `APK_SIZE` na stvarnu veličinu fajla (zaokruženo na 0.1 MB)
   - Ažuriraj `APK_DATE` na današnji datum (format: "DD. MM. YYYY.")
   - Ažuriraj `APK_VERSION` ako korisnik nije naveo — incrementuj patch broj (npr. 1.0.0 → 1.0.1)
   - Commit poruka: `release: enable APK download vX.X.X`
   - Push na `origin main` I `origin main:claude/wizardly-albattani-jvhp2z`
   - Javi korisniku: "✓ APK v{verzija} aktiviran! Deploy u toku (~2 min)."

3. **Ako fajl ne postoji ili je placeholder** (< 50 KB ili nema PK magic bytes):
   - Provjeri GitHub Releases za ovaj repo koristeći GitHub MCP alate
   - Traži release asset koji ima `.apk` ekstenziju
   - Ako ima, uzmi `browser_download_url` za najnoviji release
   - Ažuriraj `APK_URL` u `app/postavke/page.tsx` na taj URL
   - Postavi `APK_AVAILABLE = true`, ažuriraj verziju/datum/veličinu iz release metapodataka
   - Push na obje grane
   - Javi korisniku rezultat

4. **Ako nigdje nema APK-a**:
   - Objasni korisniku dvije opcije za upload:
     a) **Direktno u repo** (za APK < 25 MB): GitHub.com → repo → Add file → Upload → `public/app-release.apk`
     b) **GitHub Release** (za bilo koji APK): GitHub.com → repo → Releases → Draft new release → priloži `.apk` fajl
   - Nemoj postavljati `APK_AVAILABLE = true`

## Ažuriranje APK_URL u kodu

Ako se koristi GitHub Releases URL, u `app/postavke/page.tsx` postoji konstanta `APK_URL`.
Ako ne postoji, dodaj je ispod `APK_AVAILABLE`:
```ts
const APK_URL = 'https://github.com/pogonboskrupa/Priprema_proizvodnje/releases/latest/download/app-release.apk';
```
I u `ApkDownload` komponenti ažuriraj:
```ts
const apkUrl = APK_URL || `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/app-release.apk`;
```

## Napomene
- Uvijek provjeri stvarni fajl — nikad ne pretpostavljaj da je validan
- Attribution footer na commit poruku (Co-Authored-By + Claude-Session)
- Push na OBE grane: `origin main` i `origin main:claude/wizardly-albattani-jvhp2z`
