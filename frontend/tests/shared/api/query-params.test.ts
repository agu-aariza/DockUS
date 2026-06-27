import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeStringArray,
  toParams,
} from "../../../src/shared/api/query-params";

test("toParams omits undefined and blank values", () => {
  const params = toParams({
    page: 2,
    status: "READY",
    search: "   ",
    lateOnly: undefined,
  });

  assert.equal(params.toString(), "page=2&status=READY");
});

test("normalizeStringArray trims blank entries and returns undefined when empty", () => {
  assert.deepEqual(normalizeStringArray([" one ", " ", "two"]), ["one", "two"]);
  assert.equal(normalizeStringArray(["   ", ""]), undefined);
  assert.equal(normalizeStringArray(undefined), undefined);
});
