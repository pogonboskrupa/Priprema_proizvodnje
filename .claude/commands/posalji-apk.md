# Pošalji APK na Priprema Proizvodnje

Izvršava se kad korisnik kaže "pošalji apk na pp", "/posalji-apk", "apk je spreman" ili slično.

APK se više ne drži u repozitoriju. Gradi ga workflow `.github/workflows/build-apk.yml` i objavljuje kao GitHub Release
(`priprema-proizvodnje-v{ver}.apk` + fiksno ime `priprema-proizvodnje.apk`). Aplikacija (Postavke → Aplikacija) vuče
`releases/latest/download/priprema-proizvodnje.apk`.

## Koraci

1. Podigni verziju u `lib/version.ts` (vidi CLAUDE.md) i push na `main` — workflow se pokreće na izmjenu `lib/version.ts`, `android/**` ili `capacitor.config.ts`.
2. Provjeri run preko GitHub MCP (`actions_list`) i da release s tom verzijom postoji (`list_releases`).
3. Ako build padne, pročitaj log (`get_job_logs`) i popravi; keystore i lozinke su isključivo u GitHub Secrets (`ANDROID_KEYSTORE_B64`, `ANDROID_KEY_PASS`, `ANDROID_STORE_PASS`) — nikad ih ne commitaj ni ne ispisuj.

## Napomene
- Attribution footer na commit poruku (Co-Authored-By + Claude-Session)
- Push na OBE grane: `origin main` i `origin main:claude/wizardly-albattani-jvhp2z`
