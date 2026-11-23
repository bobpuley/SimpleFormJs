# SimpleFormJs 2.0: proposta di evoluzione

> Sintesi delle analisi in `IDEA_1.md` … `IDEA_5.md` (2026-11-24).
> Accanto a ogni spunto è indicato il file da cui viene, ad esempio `[2]` = `IDEA_2.md`.

---

## 1. Visione e posizionamento

SimpleFormJs **non è un form builder generalista**: è un **generatore di contenuti a partire da dati strutturati** `[2]`.

> Si definiscono una volta i dati necessari, si raccolgono i valori con un form e si genera tutto il resto con dei template.

Il caso d'uso reale è quello dell'esempio: **runbook e pagine Confluence** in cui chi compila il form non tocca i template e ottiene script operativi già pronti (Update e Rollback) `[1][4]`.
Per questo la direzione consigliata è **Template / Configuration Generator** (direzioni B e C in `[2]`). Competere con le librerie di form generaliste avrebbe poco senso.

Regole guida:
- **Restare piccola**: una libreria moderna e modulare con un'API pulita, non un framework `[2]`.
- **Tutto in vanilla JS, senza jQuery** `[2][3][4][5]`. La 2.0 usa solo API native del DOM (`querySelector`, `addEventListener`, `<template>`, `navigator.clipboard`, `URLSearchParams`) ed è distribuita come ES module con una build UMD per l'uso tramite `<script>`. L'unica dipendenza esterna ammessa è il motore di template: Handlebars, da rendere intercambiabile in seguito. Motivi:
  - jQuery è usato solo per selettori ed eventi, che oggi il DOM fornisce in modo nativo;
  - in ambienti condivisi come Confluence una copia globale di jQuery crea conflitti di versione e problemi di ordine di caricamento `[4]`;
  - una dipendenza in meno significa una pagina più leggera e un'integrazione più semplice.

---

## 2. Cosa preservare (punti di forza condivisi da tutte le analisi)

| Punto di forza | Perché conta |
|---|---|
| Schema dichiarativo (array di oggetti) | Leggibile, non serve conoscere gli interni `[1][2][3][5]` |
| **Separazione tra form e template di output** | Lo stesso form produce più risultati (Update/Rollback, SQL, YAML, CLI…) senza duplicare nulla `[2]` |
| Template scritti nell'HTML (`<script type="text/templates">`) | Chi scrive la pagina aggiunge output senza scrivere JS `[1][4][5]` |
| Più generatori nella stessa pagina | Ogni istanza è isolata nel suo contenitore `[1][2][4]` |
| Suggerimenti con coppie `text`/`value` | Etichetta leggibile e codice tecnico (`France` → `FR`) `[1][4]` |
| Codice breve (circa 150 righe) e incapsulato in un IIFE | Facile da capire e da riscrivere `[1][5]` |

---

## 3. Problemi da risolvere

### 3.1 Bug verificati nel codice

| # | Problema | Dove |
|---|---|---|
| B1 | `generatorId` dichiarato opzionale ma di fatto obbligatorio: senza id, `componentSelector = $` e `$.append` non esiste | `simpleform.js:41` `[1]` |
| B2 | `defaultValue` usato nell'esempio ma mai applicato | `example.html:17` `[1][2][4]` |
| B3 | L'AutoSuggest reagisce solo ai tasti A–Z: cifre, accenti, backspace e incolla non aggiornano il campo nascosto, che resta con un valore vecchio o vuoto. `keyCode` è deprecato | `simpleform.js:119` `[1][2][5]` |
| B4 | Il testo che non corrisponde a nessuna opzione azzera il valore senza avvisare; le opzioni non sono visibili né navigabili da tastiera | `simpleform.js:118-128` `[1][5]` |
| B5 | `suggestion.value \|\| suggestion` restituisce l'oggetto intero se `value` vale `""` o `0`; `indexOf(...) >= 0` è sempre vero | `simpleform.js:137,141` `[1]` |
| B6 | `fieldName` usato come classe CSS e selettore: va in conflitto con le classi interne (`code`, `container`, `inputForm`) e si rompe con spazi o caratteri come `.` e `:` | `simpleform.js:83-84` `[1]` |
| B7 | `<label for>` punta a un `name`, non a un `id`: associazione con il label e accessibilità compromesse | `simpleform.js:7` `[1][5]` |
| B8 | Il controllo su jQuery non scatta mai (il `ReferenceError` arriva prima, su `})(jQuery)`) e non esiste un controllo per Handlebars | `simpleform.js:3,152` `[1]` |
| B9 | Codice morto: `getTemplate` e `loadAndCompileTemplate` (cercano `script/templates`) e il parametro ignorato di `createScriptsDisplay` | `simpleform.js:50-63,97` `[1][2]` |

### 3.2 Correttezza e sicurezza dell'output
- **Escape mancante per il formato di destinazione**: in SQL, `O'Brien` rompe la query `[1]`.
- **Output trattato sempre come HTML** (`.html()`, `<b>` nei template): serve distinguere l'output testuale/codice (`textContent`, `<pre><code>`) dal rendering HTML esplicito, per evitare XSS con template o valori non fidati `[2][4]`.
- **Errori non gestiti**: template con sintassi non valida, schema malformato o contenitore mancante producono eccezioni poco chiare `[2][3][4][5]`.

### 3.3 Progettazione
- `ScriptGenerator` fa tutto: DOM, template, eventi, raccolta dati, rendering e reset `[2]`.
- Lo schema è poco espressivo: niente `type`, `label`, `required`, validazione `[2][3]`.
- Il contratto `text`/`value`/`placeholder`/`defaultValue` è ambiguo: non è esplicito quale proprietà finisce nel template `[4]`.
- jQuery come dipendenza obbligatoria è pesante e in ambienti condivisi come Confluence crea conflitti di versione e di ordine di caricamento `[3][4][5]`.

### 3.4 Progetto e documentazione
- Nomi incoerenti: SimpleFormJs, `ScriptGenerator` (residuo di "GenerateSQL"), `simpleform.js` e `SimpleFormJs.js` nel README `[1][3][5]`.
- Errori nel README: backtick in più, "jsdeilvr", personalizzazione dei template possibile solo modificando il sorgente `[1][4]`.
- Mancano `package.json`, una build ESM/UMD, i test e una documentazione dell'API `[1][2][3]`.

---

## 4. Proposta di API 2.0

Basata su `[2]`, integrata con il formato dichiarativo `[1]` e con gli hook `[3][5]`.

```js
import { SimpleForm } from "simpleformjs";

const generator = new SimpleForm({
  element: "#airport-generator",          // selettore o elemento; obbligatorio ed esplicito

  schema: [
    { name: "airportCode", label: "Airport code", type: "text",
      defaultValue: "CDG", required: true,
      validation: { pattern: "^[A-Z]{3}$", message: "3 lettere maiuscole" } },
    { name: "countryCode", label: "Country", type: "select",
      options: [{ text: "France", value: "FR" }, { text: "Italia", value: "IT" }] },
    { name: "vatNumber", type: "text",
      visibleWhen: { field: "countryCode", equals: "IT" } }
  ],

  templates: {                             // opzionali: in alternativa vengono letti dall'HTML
    update:   { source: "UPDATE airport SET code = {{sql airportCode}} …", mode: "text" },
    rollback: { source: "…", mode: "text" }
  },

  livePreview: true,
  persist: "url",                          // "url" | "local" | false

  onChange: (values) => {},
  onInvalid: (errors) => {},
  onRender: (outputs) => {}                // outputs = { update: "…", rollback: "…" }
});
```

Principi:
- **Zero jQuery**: l'API e l'implementazione sono in vanilla JS (ES2020+). `element` accetta un selettore o un `HTMLElement`.
- **Il valore che finisce nel template è sempre `value`**, mentre `text` serve solo per la visualizzazione `[4]`.
- **Gli id interni sono generati e non derivano dal `fieldName`**: risolve B6 e B7.
- **Il rendering restituisce stringhe**: la visualizzazione è un passo separato, che di default usa `textContent` `[2][4]`.
- **Compatibilità 1.x**: un adapter `new ScriptGenerator(schema, id)` che mappa `fieldName`→`name` e `values`→`options`.
- **Modalità senza JS per Confluence**: lo schema dichiarato in `<script type="application/json" class="sf-schema">` e un auto-init su `[data-simpleform]` `[1]`.

Struttura interna suggerita (separazione delle responsabilità, non per forza cinque classi) `[2]`:

```
SimpleForm (coordinatore)
├── SchemaValidator   – controlla lo schema e restituisce errori chiari
├── FieldRegistry     – tipi di campo built-in e personalizzati
├── FormRenderer      – DOM, eventi, visibilità condizionale
├── TemplateEngine    – compilazione, helper, rendering in stringa
└── OutputView        – anteprima, copia, download
```

---

## 5. Funzionalità, in ordine di priorità

### Must: indispensabili per il caso d'uso runbook
1. **Pulsante "Copia" per ogni output**, con feedback visivo `[1][2][4]`.
2. **Anteprima dal vivo** al posto del flusso Esegui/Reset, con evidenza dei campi mancanti `[1][2][4]`.
3. **Validazione dichiarativa**: `required`, `pattern`, `min`/`max`, `minLength`/`maxLength`, `custom`, messaggi personalizzati; blocca o segnala l'output incompleto `[1][2][3][4][5]`.
4. **Tipi di campo**: `text`, `number`, `select`, `checkbox`, `date`, `textarea` e `label` separato da `name` `[1][2][3][4][5]`.
5. **Helper Handlebars integrati**: `sql`/`quote` (escape), `upper`, `lower`, `default`, `now`, `json` `[1]`.

### Should: alto valore, costo contenuto
6. **Persistenza**: stato nell'URL (link condivisibili già compilati) o in `localStorage` `[1][4]`.
7. **Preset e profili** per ambiente (`staging` / `prod`) `[4]`.
8. **Campi condizionali** (`visibleWhen`) e **dipendenti** (`dependsOn`, es. Country → Region) `[1][2]`.
9. **Download** dell'output (`.sql`, `.yaml`, `.txt`) ed **evidenziazione della sintassi** `[1][2][4]`.
10. **Eventi e hook**: `onChange`, `onRender`, `onInvalid` e custom events `simpleform:*` `[3][5]`.

### Could: quando il core è stabile
11. **Righe ripetibili / batch**: N aeroporti → N istruzioni, oppure incolla di un CSV `[1]`.
12. **Suggerimenti asincroni**: `options` come funzione che restituisce una `Promise` `[5]`.
13. **Import/export degli schemi** come JSON autonomi, caricabili anche da URL `[2][3]`.
14. **Plugin per campi personalizzati**: `SimpleForm.registerField(name, { render, getValue, setValue, validate })` `[2]`.

### Won't (per ora): fuori dalla visione "piccola e focalizzata"
- Wrapper React/Vue/Svelte `[3]`: bastano gli hook e un'API in vanilla JS.
- Builder visuale drag-and-drop `[3]`: costoso e lontano dal caso d'uso.
- Temi Bootstrap/Tailwind `[3]`: basta un CSS di base sovrascrivibile tramite variabili CSS.

---

## 6. Roadmap

| Fase | Obiettivo | Contenuto |
|---|---|---|
| **0. Quick fix (1.x)** | Rendere affidabile ciò che esiste | B1–B9, README corretto, `package.json` e pubblicazione su jsDelivr |
| **1. Modernizzazione** | Base per la 2.0 | **Riscrittura completa in vanilla JS (rimozione di jQuery)**, distribuzione ESM/UMD, Handlebars come unica dipendenza (o motore intercambiabile), validazione dello schema, errori chiari, test (Vitest/Jest + jsdom), adapter 1.x |
| **2. Form engine** | Schema espressivo | Tipi di campo, `label`, validazione dei valori, `visibleWhen`/`dependsOn`, hook ed eventi |
| **3. Output** | Valore per l'utente finale | Anteprima dal vivo, Copia, Download, helper di escape, modalità `text`/`html`, evidenziazione |
| **4. Ecosistema** | Riuso | Persistenza e preset, batch, suggerimenti asincroni, plugin per i campi, import/export degli schemi, documentazione dell'API con esempi interattivi, npm |

Primo passo ad alto impatto e basso costo: **Fase 0, più il pulsante Copia e l'helper `sql`**, che si possono fare già sulla 1.x.

---

## 7. Note sulle analisi di partenza

Alcune affermazioni delle analisi sono state verificate sul codice e corrette:
- **`[5]` scrive che il controllo su jQuery "funziona correttamente"**: non è vero. Se jQuery manca, l'errore avviene al momento dell'invocazione dell'IIFE, prima del controllo (B8).
- **`[5]` scrive che il filtro sui tasti "impedisce il Backspace"**: in realtà il backspace cancella normalmente. Il problema è che il **valore nascosto non viene aggiornato** e resta vecchio o vuoto (B3).
- **`[2]` e `[3]` definiscono le dipendenze "leggere"**: Handlebars è giustificato, jQuery non lo è per l'uso che se ne fa. Su questo `[3][4][5]` concordano.
- Nessuna delle analisi esterne ha notato B1 (`generatorId` obbligatorio) e B6 (conflitto tra `fieldName` e classi CSS), che sono i bug più insidiosi.
