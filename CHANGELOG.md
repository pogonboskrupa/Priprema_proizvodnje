# Changelog — Priprema Proizvodnje

Verzioniranje: `MAJOR.MINOR.PATCH`
- **PATCH** (1.0.x) — ispravke bugova, sitne izmjene UI-a, dodavanje polja
- **MINOR** (1.x.0) — nova funkcionalna cjelina, refaktoring, promjena sheme
- **MAJOR** (x.0.0) — kompletna promjena arhitekture ili platforme

Posljednja cifra ide od 0 do 9. Nakon `1.6.9` povećava se srednja cifra i slijedi `1.7.0`, zatim `1.7.1` itd.

Verzija se mijenja samo u `package.json`; web i Android je čitaju iz tog izvora.

---

## [1.6.1] — 2026-10-01

### Početna i izvještaji
- Na početnoj je istaknut mjesečni pregled odjela u kojima se radilo
- U `Izvještaji → Učinak` naziv odjela otvara njegov detaljni pregled

### Verzioniranje
- Web, Android i GitHub Release koriste verziju `1.6.1` iz `package.json`
- Zadnja cifra raste do 9; nakon toga povećava se srednja cifra i zadnja se vraća na 0

---

## [1.5.122] — 2026-10-01

### Sigurnost i ovisnosti
- Next.js ažuriran na 16.3.8 radi zakrpe kritične ranjivosti
- Uklonjen ranjivi `xlsx`; izvoz koristi `write-excel-file`
- Ažurirani razvojni alati i uvedena kontrolirana `@grpc/grpc-js` zakrpa

### Kvaliteta
- Dodani TypeScript, lint, Vitest i audit koraci u CI
- Dodani testovi ključnih poslovnih pravila
- Izdvojene rekapitulacije kalendara i statističke funkcije u zasebne module
- Ispravljen uvjetni redoslijed React hookova i komponenta definirana unutar rendera

### Build i repozitorij
- Fontovi su lokalni npm resursi; build više ne ovisi o Google Fonts mreži
- Generirani `docs/` i placeholder APK uklonjeni iz repozitorija
- Deployment se pokreće samo s grane `main`
- Verzija weba, paketa i Androida izvedena je iz `package.json`
- README zamijenjen stvarnim uputama za razvoj, provjere i deployment

---

## [1.0.0] — 2026-09-21

### Dodano
- Inicijalna produkcijska verzija SPA-e
- **Auth:** PIN login (4 cifre), "Zapamti me", role-based pristup (admin/radnik)
- **Šihtarica:** dnevni unosi rada (Doznaka/Vlake), edit/brisanje
- **Izvještaji:** sedmično/mjesečno/godišnje, prikaz po radniku i po odjelu
- **Plan 2026:** upravljanje odjelima (br, GJ, naziv, površina, plan m³, status)
- **Realizacija:** status odjela (Plan / U toku / Završeno), realizacija m³
- **Pregled (admin):** mjesečni pregled svih radnika
- **Profil:** avatar upload (base64, max 2MB), ime i prezime, titula/radno mjesto
- **Admin — Korisnici:** lista radnika s avatarima, dodjela odjela, reset PIN-a
- **Admin — Novi radnik:** forma za dodavanje radnika (defaultni PIN: 1234)
- **PWA:** Service Worker (cache ppbk-v4), offline rad, install prompt
- **Verzioniranje:** `VERSION` konstanta, prikaz na login ekranu i u Postavkama
