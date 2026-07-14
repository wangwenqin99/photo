import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("admin dashboard supports login and full album management", async () => {
  const dashboard = await source("app/components/AdminDashboard.tsx");
  assert.match(dashboard, /管理员登录/);
  assert.match(dashboard, /新建相册/);
  assert.match(dashboard, /修改名称/);
  assert.match(dashboard, /确认删除/);
  assert.match(dashboard, /退出登录/);
  assert.match(dashboard, /await loadAlbums\(\)/);
  assert.match(dashboard, /ADMIN_SESSION_EXPIRED_EVENT/);
});

test("upload queue validates and tracks independent file states", async () => {
  const queue = await source("app/components/UploadQueue.tsx");
  assert.match(queue, /queued/);
  assert.match(queue, /uploading/);
  assert.match(queue, /uploaded/);
  assert.match(queue, /failed/);
  assert.match(queue, /validateImage\(/);
  assert.match(queue, /再次上传/);
  assert.match(queue, /slice\(offset, offset \+ 3\)/);
  assert.match(queue, /xhr\.upload\.onprogress/);
  assert.match(queue, /progress/);
  assert.match(queue, /onComplete\(\)/);
});

test("photo organizer supports reordering, cover selection, and deletion", async () => {
  const organizer = await source("app/components/PhotoOrganizer.tsx");
  assert.match(organizer, /设为封面/);
  assert.match(organizer, /向前移动/);
  assert.match(organizer, /向后移动/);
  assert.match(organizer, /draggable/);
  assert.match(organizer, /确认删除/);
});
