# Source provenance

This package exports the reviewed Muse contribution from private upstream commit `9975b9bbf028b0af6df714c72e4d4f814e15dace`. The private application remains private. `source-manifest.json` binds each exported source file and saved asset to its SHA-256.

The Muse transport, cited-recall selector, shadow observers, pure shadow gate, golden-memory registry, command-line runner and their existing tests are exact byte copies of the checked-out files at that commit. Their original import paths are preserved.

`upstream_sha256` hashes checked-out file bytes, which may use Windows CRLF line endings. `upstream_git_blob_sha256` hashes the immutable Git blob. Every checked-out source file matches that blob after LF normalization; exact copies preserve the checkout bytes.

Supporting files contain selected declarations from the same commit:

| Export | Retained source |
| --- | --- |
| `src/lib/memory/types.ts` | Caller fact, privacy, provenance and extraction response/schema contracts needed by the copied modules. |
| `src/lib/memory/memoryFlags.ts` | The three Muse-specific default-off flag functions. Incumbent product flags are excluded. |
| `src/types/vapiEval.ts` | Judge-plan and eval-message types. Provider API objects and local database records are excluded. |
| `src/constants/categoryEvalTemplates.ts` | The `EvalScenario` interface only. |
| `src/lib/vapi/evalRunner.ts` | The pure `buildAIJudgePlan` metadata constructor only. No Vapi client or API call is retained. |
| `src/lib/memory/consolidationContract.ts` | The original consolidation response schemas, plus an export declaration so standalone tests can import them. |

Selected declarations retain their implementation and normalize line endings to LF. Imports needed by those declarations are stated locally. No private service adapter is substituted with a mock production service.

The standalone consolidation-shadow test exercises the copied observer with the extracted schema. Package, TypeScript, Vitest and bundle configuration were added solely to run this export. They do not configure KaiCalls infrastructure.

The historical provider/offline receipts and independent generation readback are exact copies of saved synthetic evidence. Legacy HTML/video demo media are excluded from this package. The provider receipt records four real model responses over synthetic records; the offline receipt records fixture responses. Neither is a production evaluation.

Excluded material includes Next.js routes, Supabase clients and adapters, telephony integrations, database migrations, application configuration, credentials, customer records and unrelated full-product source.


The November 2 staged-phone JSON is a new sanitized summary, not an exact copy of the private original receipt and not a result of running this export. Its original-receipt SHA-256 binds the retained private source. Operational identities, raw prompts and signed media URLs are omitted. It records two manually seeded facts, two source references, provider-transcript matching, measured latency/cost and restoration. Automatic extraction and learning are unproven. The later private telephony adapters and staging configuration are excluded from this October 29 source snapshot.

The November 3 extraction summary is a new sanitized derivative of one isolated replay on an owned test-call transcript. Its example business, caller and source-call identifiers are synthetic. No raw transcript or private operational identifier is included. The reduced HTTP 200 generation receipt contains only model/provider/usage metrics. The replay used later private extraction code, not the October 29 excerpt; it is evidence, not a runnable output of this exported source. All exported code files are unchanged from the previously reviewed package.
