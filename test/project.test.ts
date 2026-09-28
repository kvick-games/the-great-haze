import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateProject } from "../tools/validate-project.ts";

test("project.dtproject and dreamengine.project.json agree and every referenced path exists", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const problems = validateProject(root);
  assert.deepEqual(problems, []);
});
