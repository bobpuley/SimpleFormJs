import { test, expect, openTour, clipboard } from './fixtures.js';

test.describe('guided tour', () => {
  test('renders every step, navigation and code panels', async ({ page }) => {
    await openTour(page);
    const steps = page.locator('.step');
    await expect(page.locator('#tour-steps a')).toHaveCount(await steps.count());
    await expect(page.locator('.step .sf-root')).toHaveCount(14);
    await page.locator('#quick-start .show-code summary').click();
    await expect(page.locator('#quick-start .show-code code')).toContainText("element: '#demo-quick'");
    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});

test.describe('1. quick start', () => {
  test('live preview, escaping, missing markers, copy and download', async ({ page }) => {
    await openTour(page, '#quick-start');
    const demo = page.locator('#demo-quick');
    const update = demo.locator('[data-template="update"]');

    await expect(update.locator('mark.sf-missing')).toHaveText('Airport name');
    await expect(update.getByRole('button', { name: 'Copy Update' })).toBeDisabled();

    await demo.getByLabel('Airport name').fill("Charles d'Gaulle");
    await expect(update.locator('code')).toHaveText("UPDATE airport\n   SET name = 'Charles d''Gaulle'\n WHERE code = 'CDG';");
    await expect(update.locator('.sf-tok-keyword').first()).toHaveText('UPDATE');

    await update.getByRole('button', { name: 'Copy Update' }).click();
    await expect(update.getByRole('button', { name: 'Copy Update' })).toHaveText('Copied!');
    expect(await clipboard(page)).toContain("SET name = 'Charles d''Gaulle'");

    const download = page.waitForEvent('download');
    await update.getByRole('button', { name: 'Download Update' }).click();
    expect((await download).suggestedFilename()).toBe('update-CDG.sql');

    const code = demo.getByLabel('Airport code');
    await code.fill('cd');
    await code.blur();
    await expect(demo.locator('[data-field="airportCode"] .sf-error')).toHaveText('Use 3 uppercase letters');
    await expect(code).toHaveAttribute('aria-invalid', 'true');
  });
});

test.describe('2-3. field types and validation', () => {
  test('field types produce typed YAML', async ({ page }) => {
    await openTour(page, '#field-types');
    const demo = page.locator('#demo-types');
    await demo.getByLabel('Replicas').fill('4');
    await demo.getByLabel('Environment').selectOption('prod');
    await demo.getByLabel('Enable autoscaling').check();
    await demo.getByLabel('Release date').fill('2026-12-01');
    const out = demo.locator('.sf-output code');
    await expect(out).toContainText('environment: prod');
    await expect(out).toContainText('replicas: 4');
    await expect(out).toContainText('autoscaling: true');
    await expect(out).toContainText('releaseDate: "2026-12-01"');
  });

  test('custom cross-field validation with translated messages', async ({ page }) => {
    await openTour(page, '#validation');
    const demo = page.locator('#demo-validation');
    await demo.getByLabel('Ticket').fill('OPS-12');
    await demo.getByLabel('Inizio').fill('2026-12-10');
    await demo.getByLabel('Fine').fill('2026-12-01');
    await demo.getByLabel('Fine').blur();
    await expect(demo.locator('[data-field="ticket"] .sf-error')).toHaveText('Formato atteso: OPS-1234');
    await expect(demo.locator('[data-field="end"] .sf-error')).toHaveText("La fine deve seguire l'inizio");
    await expect(demo.locator('.sf-summary')).toHaveText('2 campo/i da correggere');
    await expect(demo.getByRole('button', { name: /Copia/ })).toBeDisabled();
  });
});

test.describe('4. autocomplete', () => {
  test('keyboard selection maps text to value, unknown text is rejected', async ({ page }) => {
    await openTour(page, '#autocomplete');
    const demo = page.locator('#demo-autocomplete');
    const country = demo.getByRole('combobox', { name: 'Country' });
    await country.fill('vi');
    await expect(demo.getByRole('option')).toHaveText(['Viet Nam']);
    await country.press('ArrowDown');
    await country.press('Enter');
    await expect(country).toHaveValue('Viet Nam');
    await expect(demo.locator('.sf-output code')).toContainText('"country": "VN"');

    await country.fill('Atlantis');
    await country.press('Tab');
    await expect(demo.locator('[data-field="country"] .sf-error')).toHaveText('Country: choose a value from the list');
  });

  test('async suggestions', async ({ page }) => {
    await openTour(page, '#autocomplete');
    const demo = page.locator('#demo-autocomplete');
    const airline = demo.getByRole('combobox', { name: 'Airline (async)' });
    await airline.pressSequentially('ita');
    // prefix matches first, then substring matches
    await expect(demo.locator('[data-field="airline"]').getByRole('option')).toHaveText(['ITA Airways', 'Alitalia']);
    await demo.locator('[data-field="airline"]').getByRole('option', { name: 'ITA Airways' }).click();
    await expect(demo.locator('.sf-output code')).toContainText('"airline": "ITA Airways"');
  });
});

test.describe('5. conditional and dependent fields', () => {
  test('visibleWhen and dependsOn (map + optionsUrl)', async ({ page }) => {
    await openTour(page, '#conditional');
    const demo = page.locator('#demo-conditional');
    await expect(demo.getByLabel('VAT number')).toBeHidden();
    await demo.getByLabel('Country').selectOption({ label: 'Italy' });
    await expect(demo.getByLabel('VAT number')).toBeVisible();
    await expect(demo.getByLabel('Region')).toContainText('Lombardia');
    await expect(demo.getByLabel('City').locator('option')).toHaveText(['— select —', 'Roma', 'Milano', 'Napoli', 'Venezia']);
    await demo.getByLabel('City').selectOption({ label: 'Milano' });
    await demo.getByLabel('Company').fill('ACME');
    await demo.getByLabel('VAT number').fill('IT12345678901');
    await demo.getByLabel('Electronic invoice').check();
    await expect(demo.getByLabel('SDI code')).toBeVisible();
    await demo.getByLabel('SDI code').fill('ABC1234');
    await expect(demo.locator('.sf-output code')).toHaveText('company: ACME\ncountry: IT\ncity: MIL\nvat: IT12345678901\nsdi: ABC1234');

    await demo.getByLabel('Country').selectOption({ label: 'France' });
    await expect(demo.getByLabel('VAT number')).toBeHidden();
    await expect(demo.getByLabel('City').locator('option')).toHaveText(['— select —', 'Paris', 'Lyon', 'Nice']);
    await expect(demo.locator('.sf-output code')).toHaveText('company: ACME\ncountry: FR\n');
  });
});

test.describe('6. helpers and formats', () => {
  test('custom helper, shell heredoc, html mode escaping', async ({ page }) => {
    await openTour(page, '#outputs');
    const demo = page.locator('#demo-outputs');
    await expect(demo.locator('[data-template="sql"] code')).toContainText("'maintenance-citta-del-capo'");
    await expect(demo.locator('[data-template="json"] code')).toContainText('"owner": "ops-team"');
    await expect(demo.locator('[data-template="js"] code')).toContainText('message: "Say \\"hi\\" to O\'Brien"');
    await demo.getByLabel('Message').fill('<img src=x onerror=alert(1)>');
    await expect(demo.locator('[data-template="html"] .sf-html p').first()).toHaveText('<img src=x onerror=alert(1)>');
    await expect(demo.locator('[data-template="html"] img')).toHaveCount(0);
    const email = demo.locator('[data-template="email"] .sf-plain');
    await expect(email).toContainText('Subject: Maintenance: Città del Capo');
    await expect(email).toContainText('<img src=x onerror=alert(1)>');
    await expect(demo.locator('[data-template="email"] pre')).toHaveCount(0);
    const download = page.waitForEvent('download');
    await demo.getByRole('button', { name: 'Download Shell' }).click();
    expect((await download).suggestedFilename()).toBe('maintenance-citta-del-capo.sh');
  });
});

test.describe('7. presets and persistence', () => {
  test('presets fill values, the URL keeps them across reloads', async ({ page }) => {
    await openTour(page, '#presets');
    const demo = page.locator('#demo-presets');
    await demo.getByLabel('Preset').selectOption('prod');
    await expect(demo.locator('[data-template="dsn"] code')).toHaveText('postgres://readonly@db.prod.internal:6432/app?sslmode=require');
    expect(new URL(page.url()).searchParams.get('sf.demo-presets')).toContain('db.prod.internal');

    await demo.getByRole('button', { name: 'Copy share link' }).click();
    expect(await clipboard(page)).toContain('sf.demo-presets=');

    await page.reload();
    await expect(page.locator('#demo-presets [data-template="dsn"] code')).toHaveText(
      'postgres://readonly@db.prod.internal:6432/app?sslmode=require',
    );
  });

  test('localStorage persistence and reset', async ({ page }) => {
    await openTour(page, '#presets');
    await page.locator('#demo-local').getByLabel('Your name').fill('Ada');
    await page.reload();
    const local = page.locator('#demo-local');
    await expect(local.getByLabel('Your name')).toHaveValue('Ada');
    await local.getByRole('button', { name: 'Reset' }).click();
    await page.reload();
    await expect(page.locator('#demo-local').getByLabel('Your name')).toHaveValue('');
  });
});

test.describe('8. batch and CSV', () => {
  test('rows, per-row output and CSV import', async ({ page }) => {
    await openTour(page, '#batch');
    const demo = page.locator('#demo-batch');
    await demo.locator('summary', { hasText: 'Import CSV' }).click();
    await demo.getByLabel('Import CSV').fill('code;name;country\nCDG;Charles de Gaulle;FR\nFCO;Leonardo da Vinci;IT\nMAD;Adolfo Suárez Barajas;ES');
    await demo.getByRole('button', { name: 'Import rows' }).click();
    await expect(demo.locator('.sf-csv-status')).toHaveText('3 row(s) imported');
    await expect(demo.locator('fieldset.sf-row')).toHaveCount(3);
    await expect(demo.locator('[data-template="inserts"] code')).toHaveText(
      [
        "INSERT INTO airport (code, name, country) VALUES ('CDG', 'Charles de Gaulle', 'FR');",
        "INSERT INTO airport (code, name, country) VALUES ('FCO', 'Leonardo da Vinci', 'IT');",
        "INSERT INTO airport (code, name, country) VALUES ('MAD', 'Adolfo Suárez Barajas', 'ES');",
      ].join('\n'),
    );
    await expect(demo.locator('[data-template="summary"] code')).toHaveText('3 airport(s): CDG, FCO, MAD');

    await demo.getByRole('button', { name: 'Add row' }).click();
    await expect(demo.locator('[data-template="inserts"] mark.sf-missing').first()).toHaveText('Code #4');
    await demo.locator('fieldset.sf-row').nth(3).getByRole('button', { name: 'Remove' }).click();
    await demo.locator('fieldset.sf-row').nth(0).getByRole('button', { name: 'Remove' }).click();
    await expect(demo.locator('[data-template="summary"] code')).toHaveText('2 airport(s): FCO, MAD');
  });
});

test.describe('9-10. hooks and plugins', () => {
  test('hooks log events', async ({ page }) => {
    await openTour(page, '#hooks');
    const demo = page.locator('#demo-hooks');
    await demo.getByLabel('Flight').fill('AF12');
    await expect(page.locator('#hooks-log li').first()).toContainText('render Flight AF12 delayed');
    await demo.getByRole('button', { name: 'Copy Message' }).click();
    await expect(page.locator('#hooks-log li').first()).toContainText('copy notam: Flight AF12 delayed');
    await demo.getByLabel('Flight').fill('bad');
    await expect(page.locator('#hooks-log')).toContainText('invalid Flight has an invalid format');
  });

  test('custom coordinates field', async ({ page }) => {
    await openTour(page, '#plugins');
    const demo = page.locator('#demo-plugin');
    await demo.getByRole('button', { name: 'Paris CDG' }).click();
    await expect(demo.locator('.sf-output code')).toContainText('"coordinates": [2.5479, 49.0097]');
    await demo.getByRole('textbox', { name: 'Latitude' }).fill('123');
    await demo.getByRole('textbox', { name: 'Latitude' }).blur();
    await expect(demo.locator('[data-field="position"] .sf-error')).toHaveText('Position: latitude ±90, longitude ±180');
  });
});

test.describe('11-12. declarative mode and schema import/export', () => {
  test('no-code forms (inline JSON and data-schema-src)', async ({ page }) => {
    await openTour(page, '#declarative');
    const demo = page.locator('#demo-declarative');
    await demo.getByLabel('Username').fill('mario.rossi');
    await demo.getByLabel('Role').selectOption('editor');
    await expect(demo.locator('[data-template="Grant"] code')).toHaveText("GRANT EDITOR TO 'mario.rossi';");
    await demo.getByLabel('Expires').fill('2027-01-31');
    await expect(demo.locator('[data-template="Grant"] code')).toHaveText("GRANT EDITOR TO 'mario.rossi';\n-- revoke on 2027-01-31\n");

    const remote = page.locator('#demo-remote');
    await expect(remote.locator('.sf-title')).toHaveText('Airport record (loaded from airport.json)');
    await remote.getByLabel('Preset').selectOption('Roma FCO');
    await expect(remote.locator('[data-template="json"] code')).toContainText('"code": "FCO"');
  });

  test('loadSchema then exportSchema', async ({ page }) => {
    await openTour(page, '#import-export');
    await page.getByRole('button', { name: 'Load data/airport.json' }).click();
    await expect(page.locator('#demo-import .sf-title')).toHaveText('Imported with loadSchema()');
    await page.getByRole('button', { name: 'Export as JSON' }).click();
    const json = JSON.parse(await page.locator('#export-output code').textContent());
    expect(json.schema.map((f) => f.name)).toEqual(['airportCode', 'airportName', 'country', 'active']);
    expect(json.templates.insert.language).toBe('sql');
  });
});

test.describe('13. generate flow and 1.x compatibility', () => {
  test('ScriptGenerator with the original markup', async ({ page }) => {
    await openTour(page, '#legacy');
    const demo = page.locator('#demo-legacy');
    await expect(demo.locator('.sf-outputs')).toBeHidden();
    await expect(demo.getByLabel('airportCode')).toHaveValue('CDG');
    const country = demo.getByRole('combobox', { name: 'countryCode' });
    await country.fill('tur');
    await country.press('ArrowDown');
    await country.press('Enter');
    await demo.getByRole('button', { name: 'Generate' }).click();
    await expect(demo.locator('[data-template="Update"] .sf-html')).toHaveText('airportCode: CDG\ncountryCode: TR\ntimeZone: ');
    await expect(demo.locator('[data-template="Rollback"] .sf-html b')).toHaveText('airportCode: CDG');
    await demo.getByRole('button', { name: 'Reset' }).click();
    await expect(demo.locator('.sf-outputs')).toBeHidden();
  });
});

test.describe('styling (issue #3)', () => {
  test('each form is a separate card, inputs and buttons show a focus ring', async ({ page }) => {
    await openTour(page, '#quick-start');
    const card = await page.locator('#demo-quick .sf-root').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { border: cs.borderTopWidth, radius: cs.borderTopLeftRadius, padding: cs.paddingTop };
    });
    expect(card).toEqual({ border: '1px', radius: '10px', padding: '20px' });

    const input = page.locator('#demo-quick').getByLabel('Airport name');
    await input.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    expect(await input.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
  });

  test('responsive: labels stack above inputs on narrow screens', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await openTour(page, '#quick-start');
    const field = page.locator('#demo-quick [data-field="airportName"]');
    const label = await field.locator('label').boundingBox();
    const input = await field.locator('input').boundingBox();
    expect(input.y).toBeGreaterThan(label.y + label.height - 1);
  });
});
