# SimpleFormJs — Review e idee (2026-11-24)

## 1. Cosa funziona

- **Idea di base valida**: si descrivono i campi con un array di oggetti e si scrivono i template Handlebars direttamente nell'HTML (`<script type="text/templates" name="...">`). Chi scrive la pagina non deve conoscere JavaScript per aggiungere un nuovo script di output.
- **Più generatori nella stessa pagina**: ogni istanza lavora solo dentro il proprio contenitore (`get()` → `componentSelector.find`).
- **I template vengono letti da soli**: nomi e id si ricavano dall'attributo `name` (`simpleform.js:64-71`).
- **L'autosuggest accetta coppie testo/valore** (`{text:"France", value:"FR"}`) oltre alle stringhe semplici.
- **Codice breve e leggibile** (circa 150 righe), con classi piccole e responsabilità separate.

## 2. Cosa si può migliorare

### Bug concreti
- **`generatorId` è di fatto obbligatorio**, anche se il README lo dichiara opzionale: senza id, `componentSelector` diventa `$` (`simpleform.js:41`), e `$.append` non esiste, quindi il costruttore va in errore.
- **Il controllo su jQuery non serve** (`simpleform.js:3`): se jQuery manca, `})(jQuery)` lancia un `ReferenceError` prima. Il messaggio contiene HTML; manca un controllo analogo per Handlebars.
- **`defaultValue` viene ignorato**: l'esempio lo usa (`example.html:17`) ma la libreria non lo legge.
- **I `fieldName` vengono usati come classi CSS e selettori** (`.${fieldName}`): un campo chiamato `code`, `container` o `inputForm` va in conflitto con le classi interne; un nome con spazi o caratteri come `.` o `:` rompe i selettori.
- **Problemi dell'autosuggest**:
  - reagisce solo ai tasti A–Z (`simpleform.js:119`): cifre, lettere accentate, backspace e incolla non aggiornano il campo nascosto, che resta con il valore vecchio o vuoto;
  - se il testo non corrisponde a nessuna opzione, il valore viene svuotato senza avviso;
  - le opzioni non sono visibili, l'utente deve indovinarle;
  - `keyCode` è deprecato.
- **`suggestion.value || suggestion`** (`simpleform.js:137`) restituisce l'intero oggetto quando `value` vale `""` o `0`. Il controllo `indexOf(suggestion) >= 0` (`simpleform.js:141`) è sempre vero.

### Codice morto o incoerente
- `getTemplate` e `loadAndCompileTemplate` non vengono mai usati, e cercano `script/templates` invece di `text/templates`.
- `createScriptsDisplay(templates, params)` ignora il parametro `templates`.
- `<label for="{{fieldName}}">` punta a un `name` e non a un `id` (funziona solo perché il label avvolge l'input).

### Correttezza dell'output
- Gli script generati non escapano i valori: in SQL `O'Brien` produce una query rotta. Serve un helper tipo `{{sql nome}}` che escapi gli apici.

### Progetto e documentazione
- Nome incoerente: libreria SimpleFormJs, classe `ScriptGenerator`, file `simpleform.js`, mentre il README parla di `SimpleFormJs.js`.
- Nel README: backtick in più dopo `scriptGenerator);`, refuso "jsdeilvr", nessun link jsDelivr reale.
- Per personalizzare i template integrati bisogna modificare il sorgente: meglio poterli passare come opzioni.
- Mancano `package.json`, una build ESM/UMD minificata e qualsiasi test.
- jQuery è una dipendenza pesante per quello che fa: si può riscrivere in vanilla JS senza difficoltà.

## 3. Funzionalità da aggiungere

In ordine di valore per il caso d'uso (runbook / script operativi):

1. **Pulsante "Copia" per ogni script**.
2. **Anteprima dal vivo**: gli script si aggiornano mentre si scrive, al posto del flusso Esegui/Reset.
3. **Validazione**: `required`, `pattern` (regex) e messaggi d'errore prima di generare lo script.
4. **Più tipi di campo**: `select`, `number`, `date`, `textarea`, `checkbox`, e un `label` separato da `fieldName`.
5. **Helper Handlebars integrati**: `sql` / `quote` per l'escape, `upper`, `lower`, `default`, `now`.
6. **Stato salvato nell'URL o in localStorage**: link condivisibili già compilati, oppure ultimi valori ritrovati.
7. **Schema dichiarativo in HTML** (es. `<script type="application/json" class="schema">`): su Confluence non serve nemmeno il JS di inizializzazione.
8. **Righe ripetibili / modalità batch**: N aeroporti → N INSERT, oppure incolla di un CSV.
9. **Download** dell'output come `.sql` / `.txt`, ed eventualmente syntax highlighting.
10. **Campi condizionali**, visibili solo se un altro campo ha un certo valore.

## Prossimi passi suggeriti

1. Correggere i bug: `generatorId`, `defaultValue`, autosuggest, conflitti tra nomi dei campi e classi.
2. Aggiungere il pulsante Copia e l'helper per l'escape SQL.
