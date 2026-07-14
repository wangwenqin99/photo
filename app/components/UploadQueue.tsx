"use client";

import { useMemo, useRef, useState } from "react";
import { validateImage } from "@/lib/domain";

type QueueState = "queued" | "uploading" | "uploaded" | "failed";
type QueueItem = { id: string; file: File; state: QueueState; error?: string };

export function UploadQueue({ albumId, onComplete }: { albumId: string; onComplete: () => void }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => ({
    done: items.filter((item) => item.state === "uploaded").length,
    total: items.length,
  }), [items]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files).map((file) => {
      const validation = validateImage(file);
      return {
        id: crypto.randomUUID(), file,
        state: validation.ok ? "queued" as const : "failed" as const,
        error: validation.ok ? undefined : validation.message,
      };
    });
    setItems((current) => [...current.filter((item) => item.state !== "uploaded"), ...incoming]);
  }

  async function uploadItem(item: QueueItem) {
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, state: "uploading", error: undefined } : entry));
    const form = new FormData(); form.append("files", item.file);
    try {
      const response = await fetch(`/api/admin/albums/${albumId}/photos`, { method: "POST", body: form });
      const data = await response.json() as { uploaded?: unknown[]; failed?: Array<{ error: string }> };
      if (!response.ok && response.status !== 207 || !data.uploaded?.length) throw new Error(data.failed?.[0]?.error ?? "上传失败");
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, state: "uploaded" } : entry));
    } catch (error) {
      setItems((current) => current.map((entry) => entry.id === item.id ? {
        ...entry, state: "failed", error: error instanceof Error ? error.message : "上传失败，请重试",
      } : entry));
    }
  }

  async function uploadAll() {
    const pending = items.filter((item) => item.state === "queued");
    for (let offset = 0; offset < pending.length; offset += 3) {
      await Promise.all(pending.slice(offset, offset + 3).map(uploadItem));
    }
    onComplete();
  }

  return (
    <section className="upload-panel" aria-labelledby="upload-title">
      <div className="panel-heading"><div><p>UPLOAD</p><h2 id="upload-title">批量上传照片</h2></div><span>{counts.done}/{counts.total}</span></div>
      <button className="drop-zone" type="button" onClick={() => input.current?.click()}>
        <strong>选择多张图片</strong><span>JPG、PNG、WebP 或 GIF，单张不超过 20MB</span>
      </button>
      <input ref={input} hidden multiple type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => addFiles(event.target.files)} />
      {items.length > 0 && <div className="upload-list" aria-live="polite">
        {items.map((item) => <div className={`upload-row ${item.state}`} key={item.id}>
          <div><strong>{item.file.name}</strong><span>{(item.file.size / 1024 / 1024).toFixed(1)} MB</span></div>
          <span className="upload-state">{{ queued: "等待上传", uploading: "正在上传…", uploaded: "上传完成", failed: item.error ?? "上传失败" }[item.state]}</span>
          {item.state === "failed" && validateImage(item.file).ok && <button onClick={() => void uploadItem(item)}>再次上传</button>}
        </div>)}
      </div>}
      <button className="primary-button" disabled={!items.some((item) => item.state === "queued")} onClick={() => void uploadAll()}>开始上传</button>
    </section>
  );
}
