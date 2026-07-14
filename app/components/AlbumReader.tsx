"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { pageSpread } from "@/lib/domain";

type Photo = { id: string; originalName: string };
type Album = { id: string; name: string; photoCount: number; photos: Photo[] };

export function AlbumReader({ albumId }: { albumId: string }) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [error, setError] = useState(false);
  const [index, setIndex] = useState(0);
  const [mobile, setMobile] = useState(false);
  const pointerStart = useRef<number | null>(null);

  const load = useCallback(async () => {
    setError(false);
    try {
      const response = await fetch(`/api/albums/${albumId}`);
      if (!response.ok) throw new Error("request failed");
      setAlbum((await response.json() as { album: Album }).album);
    } catch { setError(true); }
  }, [albumId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const media = matchMedia("(max-width: 767px)");
    const update = () => setMobile(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const step = mobile ? 1 : 2;
  const total = album?.photos.length ?? 0;
  const previous = useCallback(() => setIndex((value) => Math.max(0, value - step)), [step]);
  const next = useCallback(() => setIndex((value) => Math.min(Math.max(0, total - 1), value + step)), [step, total]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") previous();
      if (event.key === "ArrowRight") next();
    };
    addEventListener("keydown", onKeyDown);
    return () => removeEventListener("keydown", onKeyDown);
  }, [next, previous]);

  useEffect(() => {
    if (!album) return;
    for (const photo of album.photos.slice(index + step, index + step + 2)) {
      const image = new Image(); image.src = `/api/photos/${photo.id}`;
    }
  }, [album, index, step]);

  if (error) return <main className="reader-state"><p>暂时无法打开这本相册。</p><button onClick={() => void load()}>重新尝试</button></main>;
  if (!album) return <main className="reader-state" aria-live="polite">正在翻开相册…</main>;
  if (!total) return <main className="reader-state"><p>这本相册还没有照片。</p><Link href="/">返回相册柜</Link></main>;

  const visibleIds = pageSpread(index, album.photos.map((photo) => photo.id), mobile);
  return (
    <main className="reader-shell">
      <header className="reader-header">
        <Link href="/" className="back-link">← 返回相册柜</Link>
        <div><p>PHOTO ALBUM</p><h1>{album.name}</h1></div>
        <span aria-live="polite">{Math.min(index + 1, total)}–{Math.min(index + visibleIds.length, total)} / {total}</span>
      </header>
      <section
        className={`album-spread ${mobile ? "is-mobile" : ""}`}
        aria-label="照片翻页区域"
        onPointerDown={(event) => { pointerStart.current = event.clientX; }}
        onPointerUp={(event) => {
          if (pointerStart.current === null) return;
          const distance = event.clientX - pointerStart.current;
          if (distance > 48) previous();
          if (distance < -48) next();
          pointerStart.current = null;
        }}
      >
        {visibleIds.map((id, page) => {
          const photo = album.photos.find((item) => item.id === id)!;
          return <figure className="photo-page" key={id}><img src={`/api/photos/${id}`} alt={photo.originalName} /><figcaption>{String(index + page + 1).padStart(2, "0")}</figcaption></figure>;
        })}
      </section>
      <nav className="reader-controls" aria-label="翻页控制">
        <button onClick={previous} disabled={index === 0} aria-label="上一页">← <span>上一页</span></button>
        <div className="page-track"><span style={{ width: `${((index + visibleIds.length) / total) * 100}%` }} /></div>
        <button onClick={next} disabled={index + visibleIds.length >= total} aria-label="下一页"><span>下一页</span> →</button>
      </nav>
    </main>
  );
}
