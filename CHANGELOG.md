# Changelog — Priprema Proizvodnje

Verzioniranje: `MAJOR.MINOR.PATCH`
- **PATCH** (1.0.x) — ispravke bugova, sitne izmjene UI-a, dodavanje polja
- **MINOR** (1.x.0) — nova funkcionalna cjelina, refaktoring, promjena sheme
- **MAJOR** (x.0.0) — kompletna promjena arhitekture ili platforme

Patch ide od 1.0.0 → 1.0.1 → ... → 1.0.9 → 1.1.0 (minor).

Gdje promijeniti verziju: `docs/index.html`, konstanta `VERSION` na vrhu `<script>` bloka.

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
