# Priprema Proizvodnje — Razvojne Napomene

Ovaj fajl opisuje arhitekturu SPA-e, konvencije i kritične točke na koje treba
obratiti pažnju pri svakom pregledu koda ili traženju bugova.

---

## Struktura projekta

```
docs/
  index.html   ← cijela aplikacija (HTML + CSS + JS u jednom fajlu)
  sw.js        ← Service Worker, cache ppbk-v4, network-first HTML
```

GitHub Pages servira `docs/` kao root. Ne postoji build step — sve je u jednom
HTML fajlu. Svaka promjena direktno ide na produkciju mergom u `main`.

---

## Dio 1 — Auth & Session

**Što ide ovdje:** login, PIN, sesija, remember-me, logout, role detekcija.

### Ključevi u storage-u

| Ključ | Storage | Sadržaj |
|-------|---------|---------|
| `spp_v2` | localStorage | Svi podaci app-e: `{users, odjeli, unosi}` |
| `spp_ses` | sessionStorage | Aktivna sesija `{uid}` (ne pamti između zatvaranja taba) |
| `spp_rem` | localStorage | Aktivna sesija `{uid}` — samo ako je "Zapamti me" čekirano |

**Logika pri učitavanju:**
```
spp_rem (localStorage) → ima → automatski login
spp_ses (sessionStorage) → ima → login za ovaj tab
ni jedno → prikaži login ekran
```

### Kritične funkcije

```js
me()       // vraca trenutno ulogovanog korisnika iz db.users, null ako niko
isAdm()    // me()?.role === 'admin'
ssave(rem) // snima sesiju; rem=true → localStorage (pamti), false → sessionStorage
logout()   // briše obje sesije, prikazuje login
```

### `enterApp()` — najosjetljivija funkcija u auth dijelu

**Pravilo:** Svaki put kad se zove `enterApp()` (pri svakom loginu), MORA se
eksplicitno resetovati stanje svih admin-only DOM elemenata na `hidden=true`
PRIJE nego se provjeri `isAdm()`. Bez ovog reseta, radnik koji se uloguje
nakon admina nasljeđuje admin UI.

```js
// OBAVEZNI RESET blok na početku enterApp():
document.getElementById('tnav-izvj').hidden=false;
document.getElementById('tnav-pregled').hidden=true;
document.getElementById('tnav-plan').hidden=true;
document.getElementById('tnav-real').hidden=true;
document.getElementById('sh-wsel').hidden=true;
document.getElementById('sec-users').hidden=true;
document.getElementById('m-wfg').hidden=true;
// ... i reset aktivnog taba na Šihtarica
```

### PIN sistem

- 4 cifre, plain-text u `db.users[].pin` (nema hashiranja)
- Admin default: `0000`, radnici default: `1234`
- Reset PIN resetuje na defaulte po roli

### Česte greške u ovom dijelu

- Zaboraviti resetovati admin-only elemente u `enterApp()` → radnik vidi admin UI
- `me()` vraća `null` ako user nije u `db.users` (može se desiti ako se localStorage
  ručno obriše dok je sesija aktivna) → svuda gdje se koristi `me()` provjeri null

---

## Dio 2 — Data Layer

**Što ide ovdje:** schema, migracije, CRUD, helper funkcije za podatke.

### Shema `spp_v2`

```js
{
  users: [
    {
      id: Number,          // auto-increment, uid() helper
      name: String,        // korisničko ime (UPPERCASE), za login
      pin: String,         // 4 cifre, plain-text
      role: 'worker'|'admin',
      fullName: String,    // puno ime i prezime (dodano migracijom)
      title: String,       // radno mjesto / titula (dodano migracijom)
      avatar: String,      // base64 data URI ili '' (dodano migracijom)
      odjeliIds: Number[]  // IDs odjela kojima je radnik dodijeljen (dodano migracijom)
    }
  ],
  odjeli: [
    {
      id: Number,
      br: String,          // broj odjela npr. "001A"
      gj: String,          // gospodarska jedinica
      naz: String,         // naziv
      pov: Number,         // površina u ha
      plan_cet: Number,    // plan m³ četinara
      plan_lis: Number,    // plan m³ lišćara
      real_cet: Number,    // realizacija m³ četinara
      real_lis: Number,    // realizacija m³ lišćara
      status: 'plan'|'u_toku'|'zavrseno',
      plan_poc: String,    // ISO datum početka (opciono)
      plan_kraj: String,   // ISO datum kraja (opciono)
      nap: String          // napomena (opciono)
    }
  ],
  unosi: [
    {
      id: Number,
      uid: Number,         // user.id koji je upisao
      dat: String,         // ISO datum "YYYY-MM-DD"
      vr: 'D'|'V',        // D = Doznaka, V = Vlake
      odId: Number|null,   // odjel.id (null = bez odjela)
      st: Number,          // broj stabala (samo vr='D')
      ha: Number,          // hektari (samo vr='D')
      km: Number,          // km vlaka (samo vr='V')
      nap: String          // napomena
    }
  ]
}
```

### Migracija sheme

Migracija se izvršava **jednom pri svakom učitavanju stranice** (ne samo pri prvom).
Pattern: provjeri polje, dodaj default ako fali, postavi `_migFlag=true`, na kraju
`if(_migFlag) lsave()`. Ne brisati ni ne mijenjati postojeće migracije — one su
tu za korisnike koji imaju stare podatke.

```js
// Primjer — uvijek ovako:
let _migU = false;
db.users.forEach(u => {
  if (u.fullName === undefined) { u.fullName = u.name; _migU = true; }
  // ... ostala polja
});
if (_migU) lsave();
```

### Ključne funkcije

```js
lsave()           // JSON.stringify(db) → localStorage['spp_v2'], wrappano u try/catch
uid(array)        // max(array[].id) + 1, ili 1 ako je prazan array
getOd(id)         // db.odjeli.find(o => o.id === id)
me()              // db.users.find(u => u.id === ses.uid)
```

### Brisanje s kaskadnim efektima

Pri brisanju odjela (`delOd`), obavezno:
1. `db.odjeli = db.odjeli.filter(o => o.id !== id)`
2. `db.unosi.forEach(u => { if (u.odId === id) u.odId = null; })`
3. `db.users.forEach(u => { if (u.odjeliIds) u.odjeliIds = u.odjeliIds.filter(x => x !== id); })`

Brisanje unosa: nema kaskade, direktno filter po `id`.

### Avatar sistem

- Max 2MB po slici (provjera u `profAvUpload`)
- Čuvaju se kao `data:image/...;base64,...` string u `user.avatar`
- localStorage može biti pun ako je slika prevelika → `lsave()` mora biti u
  `try/catch` i prikazati grešku korisniku (ne šutljivo failovati)
- Generisani avatar: inicijali iz `fullName` + boja iz `AV_COLORS` po `user.id % 9`

### Česte greške u ovom dijelu

- `uid()` dobiva `db.users` ili `db.odjeli` ili `db.unosi` — uvijek proslijedi
  odgovarajući array, ne tvrd-kodirani argument
- `lsave()` bez `try/catch` → crashuje kada je localStorage pun (avatar slike!)
- Zaboraviti kaskadni update pri brisanju odjela (stale IDs ostaju u users/unosi)
- Migracija koja briše ili mijenja tip postojećeg polja → NIKAD, samo dodaj

---

## Dio 3 — UI & Render Layer

**Što ide ovdje:** renderovanje tabova, modali, profil, izvještaji, šihtarica,
role-based prikaz, print.

### Role-based vidljivost tabova

| Element ID | Admin | Radnik |
|-----------|-------|--------|
| `tnav-izvj` | hidden | vidljiv |
| `tnav-pregled` | vidljiv | hidden |
| `tnav-plan` | vidljiv | hidden |
| `tnav-real` | vidljiv | hidden |
| `sh-wsel` | vidljiv | hidden |
| `sec-users` | vidljiv | hidden |
| `m-wfg` (modal worker select) | vidljiv | hidden |

**Kritično:** `[hidden]{display:none!important}` je globalno CSS pravilo.
`el.hidden = true/false` je jedini ispravan način za toggle vidljivosti.
`el.style.display = 'none'` zaobiće `!important` → ne koristiti.

### Tab system

Aktivni tab: `.tbtn.on` i `.tab-pane.on` (CSS klasa, ne `hidden`).
Promjena taba: `document.querySelectorAll('.tbtn').forEach(...)` toggle `on` klase.

Na promjenu taba se triggera `renderUsers()`, `renderProfile()`, `renderOd()` itd.
Svaki render se brani `if(!el) return` ako element ne postoji (siguran mod).

### Modal sistem

Glavni modal: `overlay` + `modal` (unos šihtarice)
Realizacija modal: `overlay2` + `modal2` (admin, realizacija odjela)

Otvaranje: `overlay.hidden = false`, zatvaranje: `overlay.hidden = true`.
State modalnog forme je globalna varijabla `edId` (null = novi unos, broj = edit).

### Izvještaji — grupiranje prikaza

```js
let curPer = 'mj';  // 'sed' | 'mj' | 'god'
let curGr  = 'inz'; // 'inz' (po radniku / moji unosi) | 'od' (po odjelu)
```

- Admin + `curGr='inz'` → tabela svih radnika sa sumama
- Admin + `curGr='od'`  → tabela svih odjela s napretkom (progress bar)
- Radnik + `curGr='inz'` → lista svojih unosa (hronološki)
- Radnik + `curGr='od'`  → odjeli u kojima je radio u periodu (sa sumama)

Group buttoni su uvijek vidljivi svim korisnicima (un-hide u `renderIzvj()`).
Label buttona se mijenja dinamički: radnik vidi "📋 Moji unosi", admin "👷 Po radniku".

### Profil sistem

Sve funkcije: `renderProfile()`, `saveProfile()`, `profAvUpload()`, `updateHdrAv()`.

- `renderProfile()` — zove se pri svakom otvaranju Postavke taba
- Admin vidi "Moj profil" karicu ali NE vidi "Dodijeljeni odjeli" sekciju
- Radnik vidi oba dijela (profil + odjeli kao read-only chips)
- `updateHdrAv()` — ažurira avatar i ime u headeru odmah pri promjeni

### Admin — upravljanje korisnicima

Funkcije: `renderUsers()`, `addUser()`, `toggleAddUser()`, `resetPin()`,
`toggleAssignOd()`, `toggleOdForUser()`.

- Novi radnik: `addUser()` — generiše `uid(db.users)`, defaultni PIN `1234`
- `name` je uvijek UPPERCASE (login je case-insensitive jer se upisano konvertuje)
- Nakon dodavanja radnika ažurirati: `renderLgUsers()` (datalist), `sh-wdd`, `m-wsel`

### Print sistem

`setPrintHd(section, period)` + `window.print()`.
Print CSS je u `@media print` bloku — sakriva header, navigaciju, dugmad.
Svaki tab koji ima print dugme ima svoju `print*()` funkciju.

### Česte greške u ovom dijelu

- Korišćenje `style.display` umjesto `.hidden` → `!important` u CSS-u pobjeđuje
- Zaboraviti resetovati `curGr = 'inz'` pri promjeni perioda (nije bug sad, ali
  može biti ako se doda redirect logika)
- `renderUsers()` pozivati samo u admin kontekstu — ima `if(!tb) return` zaštitu
  ali je svejedno neophodno biti pažljiv
- Avatar upload: `inp.value = ''` nakon učitavanja (inače ne možeš ponovo
  odabrati isti fajl jer browser ne triggeruje `change` event)

---

## Opće konvencije

- **Sve u jednom fajlu.** Nema modula, nema bundlera. JS funkcije su globalne.
  `function` deklaracije su hoistovane — `lsave()` može biti pozvana prije
  definicije u source-u.
- **Nema frameworka.** Vanilla JS, direktna DOM manipulacija.
- **Deployment:** `main` branch → GitHub Pages automatski.
  Development branch: `claude/wizardly-albattani-jvhp2z`.
- **Service Worker** cache: `ppbk-v4`. Ako se SW treba invalidirati, inkrementovati
  verziju u `docs/sw.js`.
- **Font:** Inter (UI) + DM Mono (numerički podaci) iz Google Fonts.
- **CSS tokeni** su na `:root` — ne koristiti hardkodirane boje u JS (`var(--accent)`
  u inline stilu ne radi — koristiti CSS klase ili JS čitanje computed style-a).
