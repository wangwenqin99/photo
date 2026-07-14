"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Album = {
  id: string;
  name: string;
  coverPhotoId: string | null;
  photoCount: number;
  updatedAt: number;
};

export function AlbumGrid() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch("/api/albums");
      if (!response.ok) throw new Error("request failed");
      const data = await response.json() as { albums: Album[] };
      setAlbums(data.albums);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (status === "loading") return <p className="album-status" aria-live="polite">正在打开相册柜…</p>;
  if (status === "error") return (
    <div className="album-status" role="alert">
      <p>暂时无法读取相册。</p><button onClick={() => void load()}>重新尝试</button>
    </div>
  );
  if (!albums.length) return (
    <section className="empty-albums" aria-live="polite">
      <span aria-hidden="true">◇</span>
      <h2>相册正在等待第一段故事</h2>
      <p>管理员上传照片后，相册会陈列在这里。</p>
    </section>
  );

  return (
    <section className="album-section" aria-labelledby="album-list-title">
      <div className="section-heading"><p>COLLECTION</p><h2 id="album-list-title">我们的相册</h2></div>
      <div className="album-grid">
        {albums.map((album, index) => (
          <Link className="album-book" href={`/albums/${album.id}`} key={album.id} style={{ "--book-index": index } as React.CSSProperties}>
            <div className="book-spine" aria-hidden="true" />
            <div className="book-cover">
              {album.coverPhotoId ? <img src={`/api/photos/${album.coverPhotoId}`} alt="" /> : <div className="cover-placeholder">拾光</div>}
              <div className="cover-label"><span>PHOTO ALBUM</span><h3>{album.name}</h3></div>
            </div>
            <div className="book-meta"><span>{album.photoCount} 张照片</span><span>最近更新 {new Date(album.updatedAt).toLocaleDateString("zh-CN")}</span></div>
          </Link>
        ))}
      </div>
    </section>
  );
}
