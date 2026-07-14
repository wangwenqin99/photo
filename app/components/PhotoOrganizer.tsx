"use client";

/* eslint-disable @next/next/no-img-element -- photos are dynamic R2 assets served by the app */

import { useState } from "react";
import { adminFetch } from "./adminFetch";

export type AdminPhoto = { id: string; originalName: string };

export function PhotoOrganizer({ albumId, coverPhotoId, photos, onChange }: {
  albumId: string;
  coverPhotoId: string | null;
  photos: AdminPhoto[];
  onChange: () => void;
}) {
  const [ordered, setOrdered] = useState(photos);
  const [dragged, setDragged] = useState<string | null>(null);

  async function saveOrder(next: AdminPhoto[]) {
    setOrdered(next);
    await adminFetch(`/api/admin/albums/${albumId}/order`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((photo) => photo.id) }),
    });
  }

  function move(id: string, direction: -1 | 1) {
    const index = ordered.findIndex((photo) => photo.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const next = [...ordered]; [next[index], next[target]] = [next[target], next[index]];
    void saveOrder(next);
  }

  async function setCover(photoId: string) {
    await adminFetch(`/api/admin/photos/${photoId}`, { method: "PATCH" }); onChange();
  }

  async function remove(photoId: string) {
    if (!window.confirm("确认删除这张照片？删除后无法恢复。")) return;
    await adminFetch(`/api/admin/photos/${photoId}`, { method: "DELETE" }); onChange();
  }

  return (
    <section className="photo-organizer" aria-labelledby="photo-list-title">
      <div className="panel-heading"><div><p>ORGANIZE</p><h2 id="photo-list-title">照片排序</h2></div><span>{ordered.length} 张</span></div>
      {!ordered.length ? <p className="admin-empty">还没有照片，请先从上方批量上传。</p> : <div className="photo-admin-grid">
        {ordered.map((photo, index) => <article
          className="photo-admin-card" key={photo.id} draggable
          onDragStart={() => setDragged(photo.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (!dragged || dragged === photo.id) return;
            const next = ordered.filter((item) => item.id !== dragged);
            next.splice(next.findIndex((item) => item.id === photo.id), 0, ordered.find((item) => item.id === dragged)!);
            setDragged(null); void saveOrder(next);
          }}
        >
          <div className="photo-admin-image"><img src={`/api/photos/${photo.id}`} alt={photo.originalName} />{coverPhotoId === photo.id && <span>当前封面</span>}</div>
          <p title={photo.originalName}>{index + 1}. {photo.originalName}</p>
          <div className="photo-actions">
            <button aria-label="向前移动" disabled={index === 0} onClick={() => move(photo.id, -1)}>←</button>
            <button aria-label="向后移动" disabled={index === ordered.length - 1} onClick={() => move(photo.id, 1)}>→</button>
            <button disabled={coverPhotoId === photo.id} onClick={() => void setCover(photo.id)}>设为封面</button>
            <button className="danger-link" onClick={() => void remove(photo.id)}>删除</button>
          </div>
        </article>)}
      </div>}
    </section>
  );
}
