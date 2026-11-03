# KaiCalls × Muse: A business that remembers

Calling a business back should not mean explaining your problem again. KaiCalls is a business phone service with a secretary built in. This repository contains our standalone Muse memory contribution: a scoped fact selector, structured shadow observers, a synthetic bench and tests.

## Run it

Requires Node.js 20 or newer and npm.

```sh
npm ci
npm test
npm run build
npm run bench
```

The default bench uses injected fixture responses. It makes no network, model or phone calls and needs no credentials. The build also produces a runnable bundle:

```sh
node dist/golden-memory-recall.cjs
```

## What we demonstrated

Four human test calls exercised KaiCalls’ existing caller-memory foundation. The caller corrected iPad to Android and later supplied the Pixel detail. The recordings show a missed detail as well as later recall. The existing incumbent extraction path saved facts automatically and injected history into subsequent calls. GPT-4.1 handled those conversations; Muse did not cause the memory behavior shown in those four calls.

Muse Wonder is the added memory reasoning component:

- **Topic recall on a phone call:** in a separate earlier staged test, Muse selected two manually seeded printer facts in 2.288 seconds. The provider transcript records the secretary using the returned details. The model request cost $0.003656. This demonstrates retrieval and use of seeded facts, not automatic learning.
- **An isolated extraction replay:** we passed the first human test call’s saved transcript through Muse Wonder using OpenRouter. It returned schema-valid facts and a goal, preserving the Android correction, printing problem and Wi-Fi/app uncertainties. It took 3.440 seconds and cost $0.013008, independently reconciled against the provider’s generation receipt. It did not write live memory. The [sanitized summary](evidence/muse-first-call-extraction-summary-20261103.json) replaces operational identifiers and omits the transcript. The [reduced provider receipt](evidence/muse-extraction-generation-receipt-20261103.json) preserves the model, provider and usage metrics.
- **Earlier synthetic recall evaluation:** four real Muse requests matched expected fact selections and cost $0.008376 in total. Twelve separate mocked safety cases also passed. Saved reports under `evidence/` distinguish provider calls from offline fixtures.

The completed model tests used Muse through OpenRouter. A direct Meta Model API integration and a Vesper owner callback are not demonstrated by this package.

## How the contribution works

The caller and business determine the permitted memory candidates before model selection. Active status, retention, confidence and source-call association are checked in application code. Muse selects at most three existing fact IDs. The returned text and source references come from validated records, not generated prose. Unknown IDs and cross-business records cannot introduce a recalled fact.

Extraction and consolidation shadows are separately gated observers. They validate structured outputs but do not write canonical memory. Muse is outside call pickup and does not replace the speaking model.

The code enforces one transport attempt, a deadline and output validation. The default bench uses synthetic records and mocked responses. A source-call reference proves a stored-record association; transcript entailment has not been evaluated. One earlier synthetic request took 5.431 seconds, longer than the private helper’s three-second default, so those results do not establish reliable production latency.

## Scope and provenance

This is a **reproducible contribution excerpt**, not the full deployed KaiCalls application. Engine, tests and bench retain the exact bytes from the previously reviewed export of commit `9975b9bbf028b0af6df714c72e4d4f814e15dace`. See [PROVENANCE.md](PROVENANCE.md) and [source-manifest.json](source-manifest.json).

Private phone adapters, Next.js routes, database clients, migrations, operational configuration, customer records and recordings are excluded. Later phone tests and the extraction replay are evidence summaries; the excerpt alone cannot reproduce the live phone flow or the later extraction replay. No improvement over the incumbent model, broad accuracy result, customer outcome or general production readiness is claimed.

## Optional new provider evaluation

Saved provider receipts can be inspected without spending. A fresh evaluation is optional, incurs charges and requires your own `OPENROUTER_API_KEY` plus `MUSE_MEMORY_MODEL=meta/muse-wonder` in the process environment:

```sh
npm run bench -- --provider --max-cost-usd 1
```

The smoke runner permits at most four attempts, reserves a conservative budget, caps combined output at 1024 tokens per attempt and uses minimal reasoning. Its historical pricing assumptions were checked October 29, 2026; verify current provider pricing before a paid run. A local abort does not prove a provider billing cutoff. No paid evaluation is required for the commands in “Run it.”
