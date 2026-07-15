import test from "node:test";
import assert from "node:assert/strict";
import { pageSpread, normalizeOrder, nextCover, validateImage } from "../lib/domain.ts";

test("desktop spread returns two adjacent photos", () => {
  assert.deepEqual(pageSpread(2, ["a", "b", "c", "d"]), ["c", "d"]);
});

test("mobile spread returns one photo", () => {
  assert.deepEqual(pageSpread(2, ["a", "b", "c"], true), ["c"]);
});

test("spread clamps invalid indices", () => {
  assert.deepEqual(pageSpread(99, ["a", "b"]), ["a", "b"]);
  assert.deepEqual(pageSpread(-4, ["a", "b"], true), ["a"]);
});

test("orders ids without duplicates and keeps missing ids", () => {
  assert.deepEqual(normalizeOrder(["b", "b", "a", "unknown"], ["a", "b", "c"]), ["b", "a", "c"]);
});

test("cover falls back to the first remaining photo", () => {
  assert.equal(nextCover("a", ["b", "c"]), "b");
  assert.equal(nextCover("b", ["b", "c"]), "b");
  assert.equal(nextCover("a", []), null);
});

test("accepts supported image types up to 10MB", () => {
  assert.deepEqual(validateImage({ type: "image/jpeg", size: 10 * 1024 * 1024 }), { ok: true });
});

test("rejects unsupported types and files over 10MB", () => {
  assert.equal(validateImage({ type: "image/svg+xml", size: 20 }).ok, false);
  assert.equal(validateImage({ type: "image/jpeg", size: 10 * 1024 * 1024 + 1 }).ok, false);
});
