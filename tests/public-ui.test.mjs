import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("home uses an accessible album grid with concrete Chinese copy", async () => {
  const [page, grid] = await Promise.all([source("app/page.tsx"), source("app/components/AlbumGrid.tsx")]);
  assert.match(page, /把日子，装订成册/);
  assert.match(page, /<AlbumGrid/);
  assert.match(grid, /张照片/);
  assert.match(grid, /最近更新/);
  assert.match(grid, /aria-live/);
});

test("reader supports keyboard, buttons, and touch gestures", async () => {
  const reader = await source("app/components/AlbumReader.tsx");
  assert.match(reader, /ArrowLeft/);
  assert.match(reader, /ArrowRight/);
  assert.match(reader, /onPointerDown/);
  assert.match(reader, /上一页/);
  assert.match(reader, /下一页/);
  assert.match(reader, /aria-live/);
});

test("album route renders the responsive reader", async () => {
  const page = await source("app/albums/[albumId]/page.tsx");
  assert.match(page, /<AlbumReader/);
});
