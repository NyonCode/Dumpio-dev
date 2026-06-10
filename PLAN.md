# Dumpio — oprava, sjednocení designu, nová architektura ingestu a příprava na první RC

## Context

Dumpio je Electron aplikace (React 19 + TS + Tailwind), která přijímá JSON „dumpy" přes TCP a zobrazuje je v reálném čase. Projekt je funkční, ale ve stavu „rozpracováno": **`npm run build` aktuálně padá** (typecheck hlásí ~30 chyb), ESLint hlásí 1365 chyb (z velké části kvůli lintování build artefaktů), branding je nekonzistentní (DumpeX / Dumpex / Dumpio, tři různé appId), produkční Tailwind build ztrácí část barev (dynamické třídy), a je tu mrtvý/duplicitní kód a nedokončené featury.

**Toto je příprava prvního Release Candidate (RC1) — prioritou je bezpečnost.** Vedle úklidu a redesignu rozdělíme architekturu ingestu do jasných vrstev a zavedeme HTTP-first příjem (TCP zůstane jako legacy), s bezpečností jako samostatnou, prvotřídní starostí.

Cíl (dle odsouhlasených rozhodnutí):

1. **Kvalita kódu — striktně:** opravit všechny typecheck i ESLint chyby, build musí projít čistě.
2. **IDE integrace — odstranit:** vyčistit nedokončenou/mrtvou IDE integraci (implementace se odkládá do budoucna).
3. **Design — vizuální redesign** ve směru „vyladěný dev-tool": konzistentní slate paleta, jemné stíny/borders, lepší typografie a spacing, světlý/tmavý režim. Zachovat layout (sidebar + header + seznam dumpů).
4. **Produkce:** sjednotit appId/verzi, jedna build konfigurace, ztlumit logy, funkční `npm run build` a `npm run dist` (bez code signingu).
5. **Architektura ingestu:** rozdělit na vrstvy Transport → Normalization → Store → UI bridge; HTTP-first příjem (`POST /dumps`) s TCP jako legacy, oba přes jednu sdílenou pipeline.
6. **Bezpečnost (RC1):** loopback-only bind, payload/buffer limity, ochrana proti DNS-rebinding/cross-origin, volitelný lokální token, rate limit, ztvrzená CSP a Electron hardening.

---

## Aktuální stav — klíčové nálezy

**Build blokery (typecheck):**

- `src/main/index.ts:82` — `enableRemoteModule` není platná `WebPreferences` vlastnost.
- `src/main/index.ts:278` — `error.message` na `unknown`.
- `EnhancedDumpViewer.tsx` — `getFrameworkIcon` je typovaný `Record<string,string>`/`: string`, ale vrací JSX (`<svg>`) → 6 chyb.
- `ExceptionDumpItem.tsx` — nepoužitý import `ExceptionParser`, `frame.code` možná `undefined`.
- `icons.tsx:101` — `Cannot find namespace 'JSX'`.
- `DumpViewer.tsx` (starý) — chybná inference `never[]` u stat polí (~8 chyb).
- `SettingsModal.tsx` — `useEffect` nevrací hodnotu ve všech větvích; typ `activeTab` neobsahuje `'ide'` přestože se používá.
- `exceptionParser.ts` — nepoužité proměnné, `unknown` payload, neúplný `Record` u MOCK dat (~6 chyb).

**ESLint (1365 chyb):**

- `eslint.config.mjs` ignoruje jen `node_modules/dist/out` — **lintují se i build artefakty `dist-electron/` a `release/`** (velká část `no-unused-expressions` a dalších). Po jejich vyřazení zbydou reálné chyby ve `src/` a `tests/`: hlavně `explicit-function-return-type`, `no-explicit-any`, `no-unused-vars`, `react/no-unescaped-entities`, `react-hooks/exhaustive-deps`.

**Branding / config nekonzistence:**

- Názvy: `App.tsx:233` „Loading **DumpeX**…", `Sidebar.tsx:64` komentář „Dumpio", HTML title „Dumpio".
- appId 3× různě: `electron-builder.yml` → `com.electron.app`; `package.json build.appId` → `com.tcpdumpviewer.app`; `index.ts` `setAppUserModelId('com.tcpdumpviewer')`.
- **Duplicitní build konfigurace:** `package.json` má blok `build` (řádek 53) i existuje `electron-builder.yml`. electron-vite/builder používá `electron-builder.yml` → blok v `package.json` je matoucí/ignorovaný.
- Verze: `package.json` `1.0.0`, větev `0.1.8`, `Sidebar.tsx:197` natvrdo `Version: 1.0.0`.

**Produkční Tailwind (purge):**

- `SettingsModal.tsx` používá `bg-${server.color}-500` a `bg-${color}-500` (řádky 211, 710) — dynamicky skládané třídy, které JIT v produkci odstraní → barvy zmizí. `Sidebar.tsx` to dělá správně přes statickou mapu `SERVER_COLORS`.

**Mrtvý/duplicitní kód:**

- `src/main/types.ts` — „aspirační" typy, nepoužité.
- `DumpManager.startAutoSave/stopAutoSave/cleanup` — nepoužité (auto-save řeší vlastní interval v `index.ts`).
- `components/DumpViewer.tsx` (starý, ~550 ř.) a barrel `dump-viewer/index.ts` — nikde se neimportují (App používá `EnhancedDumpViewer` přímo).
- `assets/main.css` + `assets/base.css` + `wavy-lines.svg` — zbytky electron-vite šablony, neimportované (App importuje jen `index.css`). `index.css` má navíc useknutý scrollbar styl.

**Logging:** ~50 `console.log` s emoji v main procesu — pro produkci ztlumit.

**Settings nekonzistence:** `App.tsx` `Settings` má `viewMode`/`viewerMode`, ale `settings-manager.ts` (zdroj defaultů + IPC kontrakt) je nemá → po merge s defaulty mohou být `undefined`.

**IDE integrace (k odstranění):** `index.ts:383` handler `open-in-ide` je jen `console.log` (TODO); záložka „IDE Integration" v `SettingsModal` je zakomentovaná; `onOpenInIde` se prochází komponentami, ale nic nedělá. → bude kompletně odstraněno (implementace odložena).

---

## Plán prací

### Fáze 1 — Build & config (produkční blokery)

- **Sjednotit branding na „Dumpio"**: `App.tsx` loading text, smazat zavádějící komentáře.
- **Sjednotit appId** na jednu hodnotu (návrh: `cz.nyoncode.dumpio`) v `electron-builder.yml` i `setAppUserModelId`.
- **Odstranit duplicitní `build` blok z `package.json`** — ponechat jen `electron-builder.yml` jako jediný zdroj. Doplnit do `electron-builder.yml` macOS arch (x64+arm64), kategorii a ikony, které byly jen v `package.json`.
- **Verze jako jediný zdroj pravdy:** nastavit `package.json` `version` na cílovou (návrh `0.1.8` dle větve) a v `Sidebar.tsx` číst verzi přes `window.electron.process.versions`/injektovanou konstantu místo natvrdo. (Implementačně: vystavit verzi přes Vite `define` nebo přes preload.)
- Vyčistit `electron-builder.yml`: odstranit nesouvisející macOS entitlements (kamera/mikrofon/Documents), zkontrolovat `publish` URL (`example.com` → odstranit nebo nastavit reálné; bez auto-update nech vypnuté).

### Fáze 2 — Typová bezpečnost (aby prošel `npm run build`)

- `index.ts`: odstranit `enableRemoteModule`; opravit `error.message` (`(error as Error).message`).
- `icons.tsx` / `EnhancedDumpViewer.tsx`: sjednotit framework ikony do `icons.tsx` s typem `React.ReactNode` (ne `string`); `getFrameworkIcon` má vracet `ReactNode`. Odstranit duplicitní definici ikon v `EnhancedDumpViewer`.
- `ExceptionDumpItem.tsx`: smazat nepoužitý import; ošetřit `frame.code?` (guard / default).
- `SettingsModal.tsx`: `useEffect` vždy vrací (cleanup nebo `undefined`); typ `activeTab` rozšířit/sjednotit s reálně použitými taby.
- `exceptionParser.ts`: dotypovat `payload` (vstup `unknown` → zúžit), odstranit nepoužité proměnné/konstanty, opravit MOCK `Record` (doplnit chybějící klíče nebo změnit typ).
- `DumpViewer.tsx` (starý): bude smazán (viz Fáze 5), tím chyby zmizí.

### Fáze 3 — Sjednotit datové typy a settings kontrakt

- Do `settings-manager.ts` `Settings` + `defaultSettings` **doplnit `viewMode` a `viewerMode`** (defaulty `'detailed'` / `'professional'`), ať sedí s `App.tsx` a `SettingsModal`. Aktualizovat všechny redefinice (`index.ts`, `App.tsx`) podle konvence z CLAUDE.md („uprav každou kopii na cestě, kterou měníš").
- Ověřit IPC kontrakt preload ↔ main (každý `invoke` má `handle`).

### Fáze 4 — Vizuální redesign („vyladěný dev-tool")

Společný **design systém** (Tailwind): sjednotit na **slate** paletu (teď je mix `gray` v Header/Sidebar/App a `slate` v dump-viewer), definovat konzistentní:

- povrchy (bg/surface/border) pro light i dark,
- radii, stíny (využít existující `boxShadow.glow*` z `tailwind.config.js`),
- typografii (nadpisy, mono pro hodnoty — `fontFamily.mono` už je nakonfigurováno),
- stavy hover/focus/active u tlačítek a řádků.

Dotčené komponenty: `Header.tsx`, `Sidebar.tsx`, `App.tsx`, `SettingsModal.tsx`, `EnhancedDumpViewer.tsx`, `EmptyState.tsx` a položky v `dump-viewer/` (`DumpItem`, `ExceptionDumpItem`, `DumpHeader`, `DumpToolbar`, `JsonViewer`, …).

- Zachovat layout (sidebar 64 + header + scrollovaný seznam).
- Sjednotit ikony: aktuálně mix inline `<svg>` a `lucide-react` (dep je). Návrh: přejít na `lucide-react` všude, smazat ruční SVG cesty (kromě framework log v `icons.tsx`).
- Přidat do sidebaru viditelný brand „Dumpio" + verzi (odkomentovat/přepracovat hlavičku).

### Fáze 5 — Dynamické Tailwind barvy + mrtvý kód

- `SettingsModal.tsx`: nahradit `bg-${color}-500` **statickou mapou** (převzít/ sdílet `SERVER_COLORS` ze `Sidebar.tsx` — vytáhnout do sdíleného `constants`/utility, aby existovala jen jednou). Případně doplnit `safelist` v `tailwind.config.js` jako pojistku.
- Smazat: `components/DumpViewer.tsx`, `dump-viewer/index.ts` (pokud nikde nepoužitý), `src/main/types.ts`, `assets/main.css`, `assets/base.css`, `assets/wavy-lines.svg`. Doplnit chybějící scrollbar styly do `index.css`.
- V `DumpManager` odstranit nepoužité `startAutoSave/stopAutoSave/autoSave*` (auto-save drží `index.ts`) — nebo naopak sjednotit na jeden mechanismus; preferuji ponechat `index.ts` interval a smazat duplicitu v manageru.

### Fáze 6 — Logging pro produkci

- Zavést jednoduchý logger (`src/main/logger.ts`) gateovaný `is.dev` (z `@electron-toolkit/utils`), nahradit `console.log` v `index.ts`, `tcp-server.ts`, `dump-manager.ts`. Chyby (`console.error`) ponechat.

### Fáze 7 — Odstranění IDE integrace (mrtvý kód, odloženo do budoucna)

- `index.ts`: smazat IPC handler `open-in-ide`.
- `preload/index.ts` (+ `index.d.ts`): smazat `openInIde` wrapper.
- `App.tsx`: smazat `handleOpenInIde` a prop `onOpenInIde`; ze `Settings` odstranit `ideIntegration`.
- `settings-manager.ts`: odstranit `ideIntegration` ze `Settings` i `defaultSettings`.
- `SettingsModal.tsx`: smazat (už zakomentovanou) záložku „IDE Integration" a typ `'ide'` z `activeTab`, celý blok `ideIntegration` UI.
- `dump-viewer/*` (`EnhancedDumpViewer`, `DumpItem`, `ExceptionDumpItem`, …): odstranit prop `onOpenInIde` a navázané prokliky stack framů (řádky zůstanou jen jako text).
- Poznámka: tím se zároveň vyřeší část typecheck chyb v `SettingsModal` (typ `activeTab`).

### Fáze 8 — ESLint na čistou nulu

- `eslint.config.mjs`: do `ignores` přidat `**/dist-electron`, `**/release`, `**/out` (build artefakty se nelintují — to není změkčení, generovaný kód se needituje).
- Doplnit chybějící návratové typy, odstranit `any` (nahradit konkrétními typy / `unknown` + zúžení), smazat nepoužité proměnné, ošetřit `react/no-unescaped-entities` (`&apos;` apod.) a `react-hooks/exhaustive-deps`.
- `tests/*.js`: buď přidat do `ignores` (jsou to manuální klienti, ne build), nebo dotypovat. Návrh: lintovat, ale s výjimkou pravidel nevhodných pro Node skripty (`no-require-imports`, `explicit-function-return-type`) přes override pro `tests/**`.

### Fáze 9 — Architektura ingestu (Transport → Normalization → Store → UI bridge)

**Cíl:** rozbít dnešní `tcp-server.ts` (míchá transport + framing + parsing + error handling + policy) a inline normalizaci v `index.ts` do čtyř jasných vrstev, kterými protékají oba transporty (HTTP i TCP) stejně.

**Vrstvy a jejich umístění:**

- **Transport layer** (`src/main/ingest/transports/`):
  - `http-transport.ts` — vestavěný `node:http` server, `POST /dumps` (jeden objekt nebo batch pole), `GET /health`. Žádná nová závislost.
  - `tcp-transport.ts` — refaktorovaný stávající TCP listener (jen socket + framing), zachován jako **legacy/compat**.
  - Každý transport jen přijme raw payload(y) a vydá jednotný interní event `RawDump { source, remote, raw }` — nic neparsuje do business tvaru.
- **Normalization layer** (`src/main/ingest/normalize.ts`):
  - validace vstupu (typ, povinná pole), doplnění `id`, `timestamp`, `origin`, `channel`, `flag` (default `gray`),
  - **schema versioning** (`schemaVersion`, dopředná tolerance neznámých polí),
  - limity: max hloubka, max délka řetězců, max počet klíčů (ochrana rendereru) — viz Bezpečnost,
  - nevalidní vstup → `raw` dump s červeným flagem (zachovat dnešní chování, ne zahazovat).
- **Store layer** (`src/main/store/` — z dnešního `DumpManager`):
  - in-memory buffer (newest-first), persistence, limity velikosti, pruning, export. Beze změny kontraktu navenek, jen vyčištěné.
- **UI bridge** (`src/main/index.ts`): orchestrace; do rendereru posílá **už jen validní `Dump`** přes `dump-received`. Renderer (`App.tsx`) zůstává čistý konzument (filtrování, search, stats, zobrazení).

**Endpointy (HTTP-first):**

- `POST /dumps` — `Content-Type: application/json`; tělo = `Dump` objekt **nebo** pole `Dump[]` (batch). Odpověď `202 Accepted` + `{ accepted: n }`.
- `GET /health` — `200 { ok: true, version }`.
- Volitelně `POST /dumps` přijme i `text/plain` → uloží jako `raw`.

**Migrace / kompatibilita:**

- HTTP i TCP **běží paralelně**, oba plní stejnou Normalization → Store pipeline (varianta 3).
- HTTP je nově primární/doporučený; TCP zůstává funkční pro existující SDK (`dumpio_sdk_docs.md`) → **žádné rozbití klientů v RC1**.
- Nastavení serveru rozšířit o `protocol: 'http' | 'tcp'` (default `http`); migrace stávajících konfigurací: bez `protocol` ⇒ `tcp` (legacy).
- Aktualizovat `dumpio_readme.md` / `dumpio_sdk_docs.md` o HTTP příklad (`curl`).

### Fáze 10 — Bezpečnost (priorita RC1)

**Síť / ingest:**

- **Loopback-only:** default a doporučení bind na `127.0.0.1`; při konfiguraci ne-loopback hostu zobrazit varování (riziko vystavení do sítě).
- **Payload size limit:** HTTP `Content-Length`/stream cap (default např. 1–5 MB, konfigurovatelné); **strop TCP bufferu** (dnes brace-counting buffer roste neomezeně → DoS) — po překročení spojení zahodit/uzavřít.
- **DNS-rebinding / cross-origin ochrana (HTTP):** validovat `Host` (musí být `127.0.0.1`/`localhost[:port]`); odmítat cross-origin z prohlížeče — žádné permisivní CORS hlavičky, vyžadovat buď absenci `Origin`, nebo shodný origin, příp. povinný custom header/token (browser ho cross-origin bez preflightu nenastaví). Cíl: **škodlivá webová stránka nesmí POSTovat dumpy na localhost.**
- **Volitelný lokální token:** `Authorization: Bearer <token>` (nebo `X-Dumpio-Token`); token v Settings, default vypnuto. Pro TCP volitelně handshake/úvodní pole `token`.
- **Rate limit:** jednoduchý per-connection / per-window limit proti zaplavení.

**Renderer / Electron hardening:**

- **CSP:** zpřísnit `src/renderer/index.html` — odstranit `unsafe-eval`; minimalizovat `unsafe-inline` (ideálně jen styly). Ověřit, že prod build funguje bez `eval`.
- **`window.open(url)`** ve viewerech (`ArrayViewer`, `SimpleArrayViewer`, `JsonViewer`): povolit jen schémata `http`/`https`, blokovat `javascript:`/`data:` a otevírat přes `shell.openExternal` (bezpečně), ne přímo.
- Potvrdit Electron nastavení: `contextIsolation: true` (✓), `nodeIntegration` off (✓), `enableRemoteModule` pryč (✓, řeší Fáze 2), `setWindowOpenHandler` deny (✓). Zvážit `sandbox: true` u BrowserWindow, pokud preload zůstane kompatibilní.
- **Validace v normalizaci jako obrana rendereru:** depth/velikostní limity (viz výše), aby obří/hluboce zanořený payload nepoložil UI.

**Sekvence:** doporučené pořadí pro RC1 — nejdřív Fáze 1–3 + 7 (stabilní build/typy/úklid), pak **Fáze 9 + 10 společně** (architektura + bezpečnost jádra), nakonec Fáze 4 (redesign), 6, 8. Fáze 9/10 jsou backend (main proces) a běží nezávisle na redesignu rendereru.

---

## Kritické soubory

- Main: `src/main/index.ts` (UI bridge/orchestrace), `src/main/settings-manager.ts`, `src/main/logger.ts` (nový), (smazat `src/main/types.ts`).
- Ingest (nové, z `tcp-server.ts`): `src/main/ingest/transports/http-transport.ts`, `src/main/ingest/transports/tcp-transport.ts`, `src/main/ingest/normalize.ts`, `src/main/ingest/types.ts`.
- Store (z `dump-manager.ts`): `src/main/store/dump-store.ts`.
- Bezpečnost: `src/main/security/` (token, host/origin guard, rate-limit, size limits) — sdílené oběma transporty.
- Preload: `src/preload/index.ts`, `src/preload/index.d.ts`.
- Renderer: `src/renderer/src/App.tsx`, `components/Header.tsx`, `components/Sidebar.tsx`, `components/SettingsModal.tsx`, `contexts/ThemeContext.tsx`, celý `components/dump-viewer/*`, `utils/exceptionParser.ts`, `assets/index.css`.
- Config: `package.json`, `electron-builder.yml`, `eslint.config.mjs`, `tailwind.config.js`, `src/renderer/index.html`.

## Konvence k dodržení (z CLAUDE.md)

- Typy `Dump`/`Server`/`Settings` jsou záměrně **redefinované zvlášť** ve `index.ts`, `dump-manager.ts`, `settings-manager.ts`, `App.tsx` — při změně pole upravit každou kopii na dotčené cestě (main wrap → preload → renderer).
- IPC je ručně string-keyed: každý `ipcMain.handle('x')` musí mít odpovídající `ipcRenderer.invoke('x')` v preloadu.
- Defaultní server `localhost:21234`; barvy flagů pevná sada `red|yellow|blue|gray|purple|pink|green`.
- `dist-electron/` a `release/` se needitují ručně.

## Ověření (end-to-end)

1. `npm run typecheck` — bez chyb (node i web).
2. `npm run lint` — 0 errors.
3. `npm run build` — projde.
4. `npm run dev` — aplikace naběhne; vizuální kontrola light/dark, sidebar, header, redesign.
5. Smoke test příjmu dumpů (běžící app):
   - **HTTP (nový primární):** `curl -X POST http://127.0.0.1:<port>/dumps -H 'Content-Type: application/json' -d '{"message":"hi","flag":"green"}'` → `202`; batch: tělo `[{...},{...}]`.
   - `curl http://127.0.0.1:<port>/health` → `200 {ok:true}`.
   - **TCP (legacy):** `echo '{"message":"hi","flag":"green"}' | nc localhost 21234`.
   - `node tests/test-exception-client.js` a `node tests/test-context.js` — exception + multi-framework render.
6. **Bezpečnostní ověření:**
   - cross-origin POST z prohlížeče (jiný `Origin`) je **odmítnut**; DNS-rebinding (špatný `Host`) odmítnut;
   - nad-limitní payload (velikost/hloubka) odmítnut nebo bezpečně oříznut, app nespadne;
   - se zapnutým tokenem požadavek bez tokenu → `401`;
   - URL ve vieweru otevírá jen `http/https` (test `javascript:` odkazu);
   - prod build běží bez `eval` (CSP bez `unsafe-eval`).
7. Ověřit produkční purge barev: po `npm run build` zkontrolovat, že server/flag barvy v Settings i sidebaru jsou vidět (statická mapa / safelist).
8. `npm run dist` (resp. `build:mac`) — vytvoří balíček bez pádu.

## Rozhodnutí pro RC1 (dořešeno — viz `RELEASE.md`)

Tyto body byly původně „mimo rozsah"; pro RC1 jsou teď **vědomě rozhodnuté a zafixované**:

- **Code signing / notarizace / auto-update — vypnuto.** `electron-builder.yml`: `mac.identity: null`, `mac.notarize: false`, žádný `publish` blok, žádná `electron-updater` závislost. Postup pro pozdější zapnutí je popsán v `RELEASE.md` a v komentáři v `electron-builder.yml`.
- **Žádné nové runtime závislosti.** HTTP přes vestavěný `node:http`, TCP přes `node:net`, ikony přes už přítomné `lucide-react`. Runtime deps: `@electron-toolkit/preload`, `@electron-toolkit/utils`, `lucide-react`.
- **HTTPS/TLS u lokálního ingestu — záměrně neimplementováno.** Ingest je loopback-only (ne-loopback jen po explicitním „Allow remote"), takže provoz neopouští stroj a TLS by jen přidal správu certifikátů bez reálného přínosu. Ostatní hardening (size/buffer limity, Host/Origin guard, token, rate limit) je v `src/main/security/`.
