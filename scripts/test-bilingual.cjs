// Runs the actual TypeScript service without installing the desktop dependencies.
const { stripTypeScriptTypes } = require('node:module');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const cache = new Map();
let calls = 0;
let handler = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '中文译文' } }] }) });
const context = vm.createContext({ URL, TextEncoder, crypto: webcrypto, AbortController, setTimeout, clearTimeout,
  fetch: async (...args) => { calls++; return handler(...args); } });
(async () => {
  const storage = new vm.SyntheticModule(['default'], function () {
    this.setExport('default', { getItem: async key => cache.get(key) || null, setItem: async (key, value) => cache.set(key, value) });
  }, { context });
  const source = stripTypeScriptTypes(readFileSync('src/utils/reader/bilingual.ts', 'utf8'));
  const mod = new vm.SourceTextModule(source, { context });
  await mod.link(() => storage); await mod.evaluate();
  const { completionUrl, translateParagraph, cachedTranslation, cacheKey } = mod.namespace;
  const config = { baseUrl: 'https://example.org/v1/', model: 'test' };
  assert.equal(completionUrl(config.baseUrl), 'https://example.org/v1/chat/completions');
  assert.equal(completionUrl('https://example.org/v1/chat/completions'), 'https://example.org/v1/chat/completions');
  for (const url of ['http://example.org', 'https://user:pass@example.org', 'https://example.org?key=secret']) assert.throws(() => completionUrl(url));
  handler = async (url, options) => {
    assert.equal(url, completionUrl(config.baseUrl));
    assert.equal(options.headers.Authorization, 'Bearer secret');
    assert.equal(JSON.parse(options.body).messages[1].content, 'Original paragraph');
    return { ok: true, json: async () => ({ choices: [{ message: { content: '中文译文' } }] }) };
  };
  const signal = new AbortController().signal;
  assert.equal(await translateParagraph('Original paragraph', config, 'secret', signal), '中文译文');
  assert.equal(await translateParagraph('Original paragraph', config, '', signal), '中文译文');
  assert.equal(calls, 1, 'cached translation must not call API');
  assert.equal(await cachedTranslation('Original paragraph', config), '中文译文');
  assert.notEqual(await cacheKey('Original paragraph', config), await cacheKey('Original paragraph', { ...config, model: 'other' }));
  handler = async () => ({ ok: false, status: 429 });
  await assert.rejects(() => translateParagraph('Rate limited', config, 'secret', signal), /429/);
  assert.equal(await cachedTranslation('Rate limited', config), null);
  handler = async () => ({ ok: true, json: async () => ({ choices: [] }) });
  await assert.rejects(() => translateParagraph('Malformed', config, 'secret', signal), /API/);
  handler = async (_, options) => new Promise((resolve, reject) => {
    if (options.signal.aborted) reject(new Error('aborted'));
    else options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  const controller = new AbortController();
  const pending = translateParagraph('Cancel me', config, 'secret', controller.signal);
  controller.abort();
  await assert.rejects(() => pending, /aborted/);
  assert.equal(await cachedTranslation('Cancel me', config), null);
  console.log('PASS: endpoint validation, request payload, persistent cache, model isolation, HTTP failure, malformed response, cancellation');
})().catch(error => { console.error(error); process.exitCode = 1; });
