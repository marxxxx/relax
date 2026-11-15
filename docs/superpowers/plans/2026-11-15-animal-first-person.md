# Tier-First-Person (Ride-Ansicht pro Tier) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unter dem „Tiere“-Slider einen Button pro Gattung (Fuchs, Reh, Vogel, Möwe, Delfin) zeigen; Klick wechselt in eine First-Person-Ansicht, die dem jeweiligen Tier folgt (nicht steuerbar). Erneuter Klick auf dieselbe Gattung wechselt zum nächsten sichtbaren Tier dieser Gattung. Escape (oder „Rundblick“-Button) entkoppelt und wechselt in die Rundum-Sicht mit Kamera auf dem zuletzt gewählten Tier.

**Architecture:** `state` bekommt zwei Felder: `rider` (das Tier, dem die Kamera folgt, sonst `null`) und `watch` (Tier, das die Orbit-Kamera beobachtet, sonst `null`). `controls.js` bleibt eigentumsfrei an animals-Code: `updateCamera` liest `state.rider` per Duck-Typing (`rider.anchor`, `rider.eyeOff`, `rider.g`) und folgt in `fp`-Modus dem Tier statt WASD; im Orbit-Zweig folgt `tTgt` dem `watch`-Tier. `animals.js` erzeugt pro Tier ein `anchor` (Kopf/Neck/Gruppe) und einen lokalen `eyeOff`-Vektor, baut die Gattungs-Buttons in ein neues `#animalBtns`-Element und setzt bei Klick `state.rider` (erneuter Klick derselben Gattung → nächstes sichtbares Exemplar zyklisch). Escape-Handling und Modus-Logik liegen in `controls.js`.

**Tech Stack:** Plain ES modules im Browser, global `THREE` r128 (cdnjs), kein Build-Schritt. Verifikation per lokalem HTTP-Server + Playwright (Konsole, `window.__lichtung`, Screenshots). Es gibt kein Test-Suite in diesem Repo.

**Spec:** Genehmigtes Design im Gespräch (2026-11-15): Button pro Gattung unter dem Tiere-Slider; Klick → fp-Ansicht auf Tier, Steuern nicht möglich; Escape → Rundum-Sicht mit Kamera auf dem zuvor gewählten Tier (folgt ihm dort, bis gepannt wird); Klick auf dieselbe Gattung → nächstes Tier dieser Gattung; Tier wird per Slider unsichtbar → Rückfall in normalen fp-Modus.

## Global Constraints

- THREE r128 global API only.
- Keine neuen `rnd()`-Aufrufe und keine Import-Reihenfolge-Änderung — sonst verschiebt sich die Welt.
- Neue Imports nur in der Form `from './x.js'` (single quotes), damit die deploy-sed-Regel greift.
- Dichteren, kompakten Stil der bestehenden Module beibehalten; UI-Texte deutsch.
- `web/js/animals.js` bleibt letztes Import in `main.js` (keine Änderung nötig).

## Review Focus

- Kamera folgt exakt dem Tier (Anchor-Weltposition + `eyeOff` über `matrixWorld`, Blickrichtung `g.rotation.y + PI`, Pitch aus Anchor-Neigung) — kein Ruckeln, kein Steuern.
- Escape nur entkoppeln, wenn `state.rider` gesetzt; sonst normales fp→Rundblick. `watch` wird bei Pan/Doubleclick-Home/Wechsel in fp gelöscht.
- Slider auf 0 (oder Sturm für Möwen) während des Reitens: `rider` wird in `updateAnimals` auf `null` gesetzt, Buttons werden deaktiviert/aktiviert.
- Erneuter Klick derselben Gattung rotiert zyklisch nur über **sichtbare** Tiere.
- Keine Konsolen-Fehler beim Laden; Buttons sichtbar unter dem Slider; Screenshots in Ride-Ansicht und nach Escape.

---

### Task 1: State-Felder in `web/js/state.js`

**Files:**
- Modify: `web/js/state.js:3`

- [ ] **Step 1:** `state` um `rider:null,watch:null` ergänzen (eine Zeile, bestehendes Objekt erweitern).
- [ ] **Step 2:** Verifizieren: `grep -n "rider" web/js/state.js` zeigt die neue Zeile.

### Task 2: Button-Container + CSS (`web/index.html`, `web/css/style.css`)

**Files:**
- Modify: `web/index.html:56-60` (nach dem `.animalRow`-Div)
- Modify: `web/css/style.css:95-99` (direkt danach)

- [ ] **Step 1:** In `index.html` nach `</div>` der `.animalRow` einfügen: `<div class="animalBtns" id="animalBtns" role="group" aria-label="Erste-Person-Ansicht eines Tiers wählen"></div>`.
- [ ] **Step 2:** In `style.css` nach `.animalRow .val{...}` ergänzen: `.animalBtns{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}` und `.abtn{flex:1;appearance:none;border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:14px;padding:7px 4px;font:600 13px/1 "Karla",system-ui,sans-serif;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap}` plus `.abtn span{font-size:15px}`, `.abtn[aria-pressed="true"]{background:var(--ink);color:#1c241f;border-color:var(--ink)}`, `.abtn:disabled{opacity:.35;cursor:default}` (Stil an `.chip` angelehnt).

### Task 3: Tiere um `kind`/`anchor`/`eyeOff` erweitern + Gattungs-Buttons in `web/js/animals.js`

**Files:**
- Modify: `web/js/animals.js`

**Interfaces:**
- Consumes: zusätzlich `setMode` aus `./controls.js` (Importzeile `import {player} from './controls.js';` zu `import {player,setMode} from './controls.js';` erweitern — Form bleibt `from './controls.js'`).
- Produces: jedes Tier-Objekt hat `kind` ('fox'|'deer'|'bird'|'gull'|'dolphin'), `anchor` (Object3D: fox `head`, deer `neck`, sonst `g`) und `eyeOff` (THREE.Vector3, lokal zum anchor: fox `(0,.04,.07)`, deer `(0,.2,.12)`, bird `(0,.12,.05)`, gull `(0,.2,.08)`, dolphin `(0,.06,.35)`); `KINDS`-Buttons in `#animalBtns`; `state.rider`/`state.watch` werden gesetzt.

- [ ] **Step 1:** `makeFox()`-Return um `anchor:head,eyeOff:new THREE.Vector3(0,.04,.07)` ergänzen; `makeDeer(stag)` um `anchor:neck,eyeOff:new THREE.Vector3(0,.2,.12)`; `makeDolphin()` um `anchor:g,eyeOff:new THREE.Vector3(0,.06,.35)`.
- [ ] **Step 2:** In den Populations-Loops per `Object.assign` `kind` setzen: birds `{kind:'bird',anchor:o.g... }` — konkret: nach `Object.assign(makeBird(...),{...})` jeweils `o.anchor=o.g;o.eyeOff=new THREE.Vector3(0,.12,.05)` (birds) bzw. `(0,.2,.08)` (gulls) und `kind:'bird'`/`kind:'gull'` im Object.assign; dolphins `kind:'dolphin'` plus `anchor:g, eyeOff (0,.06,.35)`.
- [ ] **Step 3:** Unten im UI-Abschnitt (nach dem Slider-Block) ergänzen: `const ALL=[...land,...birds,...gulls,...dolphins];` und `const KINDS=[{id:'fox',icon:'🦊',name:'Fuchs'},{id:'deer',icon:'🦌',name:'Reh'},{id:'bird',icon:'🐦',name:'Vogel'},{id:'gull',icon:'🕊️',name:'Möwe'},{id:'dolphin',icon:'🐬',name:'Delfin'}].map(k=>({...k,arr:ALL.filter(a=>a.kind===k.id)}));` Dann Buttons bauen: für jedes `k` ein `<button class="abtn">` mit `<span>icon</span>name`, `aria-pressed="false"`, Klick-Handler `onKind(k)` in `$('animalBtns')` anhängen.
- [ ] **Step 4:** Funktionen definieren: `function vis(k){return k.arr.filter(a=>a.g.visible);}` `function syncBtns(){for(const k of KINDS){const b=k.btn,n=vis(k).length;b.disabled=!n;b.setAttribute('aria-pressed',!!(state.rider&&state.rider.kind===k.id&&state.rider.g.visible)+'');}}` (pressed nur wenn rider sichtbar) und `function attach(a){if(state.mode!=='fp')setMode('fp');state.rider=a;state.watch=null;const h=$('hint');h.textContent='Du folgst dem '+a.kindName+' – Esc für Rundblick';h.classList.remove('gone');clearTimeout(attach.t);attach.t=setTimeout(()=>h.classList.add('gone'),5000);syncBtns();}` — `kindName` am Tier speichern (z. B. `a.kindName=k.name` beim Bau) oderLookup über KINDS. `function onKind(k){const v=vis(k);if(!v.length)return;if(state.rider&&state.rider.kind===k.id){const i=v.indexOf(state.rider);attach(v[(i+1)%v.length]);}else attach(v[0]);}`
- [ ] **Step 5:** In `updateAnimals` nach den `visible`-Zuweisungen ergänzen: `if(state.rider&&!state.rider.g.visible){state.rider=null;} syncBtns();`
- [ ] **Step 6:** Slider-`input`-Handler erweitern um `syncBtns();`.

### Task 4: Kamera folgt Tier + Escape/Watch in `web/js/controls.js`

**Files:**
- Modify: `web/js/controls.js`

**Interfaces:**
- Consumes: `state.rider`/`state.watch` aus `./state.js` (Duck-Typing auf `rider.anchor`, `rider.eyeOff`, `rider.g` — kein Import aus `animals.js`, vermeidet Zyklus).
- Produces: `updateCamera` folgt in fp+rider dem Tier; Orbit folgt `state.watch`; `setMode` räumt rider/watch auf; Escape entkoppelt.

- [ ] **Step 1:** Modul-level `const camP=new THREE.Vector3();` ergänzen (nahe `export const player`).
- [ ] **Step 2:** `pan(dx,dy)` und `goHome()` um `state.watch=null;` ergänzen.
- [ ] **Step 3:** `setMode` anpassen: im `m==='fp'`-Zweig `state.rider=null;state.watch=null;` ergänzen; im `else`-Zweig ersetzen durch: `camera.near=.1;if(state.rider){state.watch=state.rider;state.rider=null;const p=state.watch.g.position;tTgt.set(p.x,state.watch.x!==undefined?p.y+.8:p.y,p.z);tDist=clamp(tDist,9,16);}else if(!state.watch){target.copy(HOME);tTgt.copy(HOME);}`.
- [ ] **Step 4:** keydown-Handler ergänzen: `if(e.code==='Escape'){if(state.rider){const w=state.rider;state.rider=null;state.watch=w;const p=w.g.position;tTgt.set(p.x,w.x!==undefined?p.y+.8:p.y,p.z);tDist=clamp(tDist,9,16);setMode('orbit');}else if(state.mode==='fp')setMode('orbit');}` (Achtung: `setMode('orbit')` darf dann `watch` nicht löschen — siehe Step 3, dort bleibt watch erhalten).
- [ ] **Step 5:** pointermove-Zeile `if(state.mode==='fp'){...}` zu `if(state.mode==='fp'){if(!state.rider){const k=...;player.yaw-=dx*k;player.pitch=clamp(...);}p.x=e.clientX;p.y=e.clientY;return;}` umbauen (Ziehen tut nichts beim Reiten).
- [ ] **Step 6:** In `updateCamera` fp-Zweig umschließen: `if(state.rider){const r=state.rider,an=r.anchor||r.g;an.updateWorldMatrix(true,false);camP.set(r.eyeOff.x,r.eyeOff.y,r.eyeOff.z).applyMatrix4(an.matrixWorld);camera.rotation.order='YXZ';camera.rotation.set(clamp(-(an.rotation.x||0)-.03,-1.3,1.3),r.g.rotation.y+Math.PI,0);camera.position.copy(camP);target.copy(camP);joy.style.display='none';}else{joy.style.display=''; ...bestehender Walk-Code... }` — `clamp` ist bereits importiert.
- [ ] **Step 7:** Orbit-Zweig: vor `tTgt.y=...` einfügen: `if(state.watch){if(!state.watch.g.visible)state.watch=null;else{const p=state.watch.g.position;tTgt.set(p.x,state.watch.x!==undefined?p.y+.8:p.y,p.z);}}` und die bestehende `tTgt.y=Math.max(...)`-Zeile in `else` kapseln bzw. zu `if(!state.watch)tTgt.y=Math.max(heightAt(tTgt.x,tTgt.z),SEA)+HOFF;` umbauen.

### Task 5: Browser-Verifikation (serve + Playwright)

**Files:** keine (nur Verifikation)

- [ ] **Step 1:** `python3 -m http.server -d web 8123` im Hintergrund starten.
- [ ] **Step 2:** Playwright: `http://localhost:8123` öffnen, Loader abwarten, Konsolen-Fehler sammeln — erwartet: keine.
- [ ] **Step 3:** `document.querySelectorAll('#animalBtns .abtn').length` === 5; Klick auf „Fuchs“ → `__lichtung.state.mode==='fp'` und `state.rider.kind==='fox'`; Kamera-Position ≈ rider-Position (Sample über `__lichtung` + camera nicht exponiert — stattdessen `state.rider.g.position` mit gerenderter Kameraposition vergleichen via `THREE` nicht global verfügbar im evaluate? `camera` nicht exponiert — Prüfung über Screenshot + `state.rider` reicht; zusätzlich `document.querySelector('.abtn[aria-pressed="true"]').textContent` enthält „Fuchs“).
- [ ] **Step 4:** Erneuter Klick auf „Fuchs“ → `state.rider` ist anderes Objekt (bei nur einem Fuchs bleibt es derselbe — dann Reh klicken: `rider.kind==='deer'`, erneuter Klick → nächstes Reh: anderes Objekt).
- [ ] **Step 5:** Escape drücken → `state.mode==='orbit'`, `state.rider===null`, `state.watch.kind` === vorherige Gattung; Screenshot (Rundblick auf Tier).
- [ ] **Step 6:** Slider `#animals` auf 0 setzen (input-Event) → `state.rider===null`, alle Buttons `disabled`; Screenshot. Slider zurück auf 50.
- [ ] **Step 7:** Screenshots: Ride-Ansicht Fuchs (Tag), Ride-Ansicht Vogel, nach Escape. Konsolen-Fehler nochmal prüfen; HTTP-Server stoppen; Ergebnisse melden.
