import { readFile } from 'node:fs/promises';
import process from 'node:process';
import {
  buildOpenApiDocument,
  serializeOpenApiDocument,
} from './openapi-document';

/**
 * Guards the public contract. Two failures, both of which have bitten this repo.
 *
 * 1. **Stale document** — the committed `openapi/chronos-openapi.json` no longer
 *    matches what the contract generates. External clients consume the committed
 *    file, so a contract edit that skips `bun run openapi:generate` ships them a
 *    lie.
 *
 * 2. **A delete returning a row** — `AGENTS.md` states deletes answer `{ id }`
 *    (or `{ ok: true }` where there is no id). A delete that answers the entity
 *    instead gives every generated client the wrong model.
 *
 * Run with `bun run openapi:check`.
 */

type JsonSchema = {
  $ref?: string;
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  items?: JsonSchema;
  oneOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  type?: string;
};

type Operation = {
  operationId?: string;
  responses?: Record<
    string,
    { content?: Record<string, { schema?: JsonSchema }> }
  >;
};

type Document = {
  components?: { schemas?: Record<string, JsonSchema> };
  paths?: Record<string, Record<string, Operation>>;
};

const DOCUMENT_PATH = 'openapi/chronos-openapi.json';

/**
 * Deletes answer `{ id }` (or `{ ok: true }`). This one deliberately returns the
 * refreshed parent row: it deletes an announcement's *image*, and the admin
 * screen repaints the row from the response.
 */
const DELETE_EXCEPTIONS: Record<string, string> = {
  deleteNewsAnnouncementsByIdImage:
    'deletes a sub-resource; returns the refreshed announcement',
};

const spec = (await buildOpenApiDocument()) as unknown as Document;
const expected = serializeOpenApiDocument(spec);
const out = (line: string) => process.stdout.write(`${line}\n`);
const fail = (line: string) => process.stderr.write(`${line}\n`);

let failed = false;

// 1. the committed document must be what the contract generates
let committed: string | null;
try {
  committed = await readFile(DOCUMENT_PATH, 'utf8');
} catch {
  committed = null;
}

if (committed === null) {
  fail(`✗ ${DOCUMENT_PATH} is missing — run \`bun run openapi:generate\``);
  failed = true;
} else if (committed === expected) {
  out(`✓ ${DOCUMENT_PATH} matches the contract`);
} else {
  fail(
    `✗ ${DOCUMENT_PATH} is stale — run \`bun run openapi:generate\` and commit it.`
  );
  fail(
    '  A change here is client-visible: the mobile client generates from this document.'
  );
  failed = true;
}

// 2. deletes answer `{ id }`, not a row
const deref = (schema: JsonSchema | undefined): JsonSchema | undefined => {
  if (!schema?.$ref) {
    return schema;
  }
  const name = schema.$ref.split('/').pop() ?? '';
  return spec.components?.schemas?.[name] ?? schema;
};

/** Every property name a response can carry, across union branches. */
const collectProperties = (
  schema: JsonSchema | undefined,
  found: Set<string> = new Set()
): Set<string> => {
  const node = deref(schema);
  if (!node) {
    return found;
  }

  const alternatives = node.anyOf ?? node.oneOf ?? node.allOf;
  if (alternatives?.length) {
    for (const alternative of alternatives) {
      collectProperties(alternative, found);
    }
    return found;
  }

  for (const name of Object.keys(node.properties ?? {})) {
    found.add(name);
  }
  return found;
};

const convention: string[] = [];
const known: string[] = [];

for (const methods of Object.values(spec.paths ?? {})) {
  for (const [method, operation] of Object.entries(methods)) {
    if (method !== 'delete' || !operation.operationId) {
      continue;
    }

    // A create answers 201; a delete answers 200.
    const success =
      operation.responses?.['200'] ?? operation.responses?.['201'];
    const body = collectProperties(
      success?.content?.['application/json']?.schema
    );
    const isDeleteShape =
      body.size === 0 ||
      (body.size === 1 && (body.has('id') || body.has('ok')));
    if (isDeleteShape) {
      continue;
    }

    const line = `${operation.operationId}: DELETE answers {${[...body].sort().join(', ')}}`;
    if (DELETE_EXCEPTIONS[operation.operationId]) {
      known.push(`${line}\n      ${DELETE_EXCEPTIONS[operation.operationId]}`);
    } else {
      convention.push(
        `${line} — deletes answer { id } (or { ok: true }); a client reading .id from this breaks`
      );
    }
  }
}

if (known.length > 0) {
  out(`! ${known.length} known divergence(s):`);
  for (const line of known) {
    out(`  ${line}`);
  }
}

if (convention.length > 0) {
  fail(`✗ ${convention.length} delete(s) break a documented convention:`);
  for (const line of convention) {
    fail(`  ${line}`);
  }
  failed = true;
} else {
  out('✓ every delete answers { id } (or { ok: true })');
}

process.exit(failed ? 1 : 0);
