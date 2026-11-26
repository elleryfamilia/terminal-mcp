import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// The JSON Schema a client sees for each tool's arguments is generated from the
// zod schema that validates them (src/tools/schema.ts), so it can only change
// when the zod schema does. This pins the wire contract: a description or type
// that moves shows up as a diff here, instead of silently reaching a client's
// prompt. If a change is intended, update test/fixtures/tool-schemas.json.
const TOOL_MODULES = [
  "type",
  "sendKey",
  "getContent",
  "screenshot",
  "startRecording",
  "stopRecording",
  "createSession",
  "listSessions",
  "destroySession",
];

async function collectInputSchemas() {
  const schemas = {};
  for (const name of TOOL_MODULES) {
    const mod = await import(`../dist/tools/${name}.js`);
    const tool = Object.values(mod).find(
      (value) => value && typeof value === "object" && "name" in value && "inputSchema" in value
    );
    assert.ok(tool, `${name}.ts should export a tool definition`);
    schemas[tool.name] = tool.inputSchema;
  }
  return schemas;
}

test("tool input schemas match the pinned wire contract", async () => {
  const expected = JSON.parse(
    fs.readFileSync(new URL("./fixtures/tool-schemas.json", import.meta.url), "utf8")
  );

  assert.deepEqual(await collectInputSchemas(), expected);
});

test("every advertised tool schema is self-consistent", async () => {
  const schemas = await collectInputSchemas();

  for (const [name, schema] of Object.entries(schemas)) {
    assert.equal(schema.type, "object", `${name}: inputSchema.type`);
    assert.ok(Array.isArray(schema.required), `${name}: inputSchema.required should be an array`);

    for (const field of schema.required) {
      assert.ok(
        field in schema.properties,
        `${name}: required field '${field}' is not in properties`
      );
    }

    // A field the client can send must carry a type; anything else is an
    // argument the model cannot reliably fill in.
    for (const [field, property] of Object.entries(schema.properties)) {
      assert.ok(
        property && typeof property === "object" && "type" in property,
        `${name}.${field}: property has no type`
      );
    }
  }
});
