"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { PhotoOrganizer, type AdminPhoto } from "./PhotoOrganizer";
import { UploadQueue } from "./UploadQueue";

type AlbumSummary = { id: string; name: string; coverPhotoId: string | null; photoCount: number; updatedAt: number };
type AlbumDetail = AlbumSummary & { photos: AdminPhoto[] };

export function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loginError, setLoginError] = useState("");
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AlbumDetail | null>(null);
  const [newName, setNewName] = useState("");

  const loadAlbums = useCallback(async () => {
    const response = await fetch("/api/albums");
    if (!response.ok) return;
    const data = await response.json() as { albums: AlbumSummary[] };
    setAlbums(data.albums);
    setSelectedId((current) => current && data.albums.some((album) => album.id === current) ? current : data.albums[0]?.id ?? null);
  }, []);

  const loadSelected = useCallback(async () => {
    if (!selectedId) { setSelected(null); return; }
    const response = await fetch(`/api/albums/${selectedId}`);
    if (response.ok) setSelected((await response.json() as { album: AlbumDetail }).album);
  }, [selectedId]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session")
      .then((response) => response.json())
      .then(async (data: { authenticated: boolean }) => {
        if (!active) return;
        setAuthenticated(Boolean(data.authenticated));
        if (data.authenticated) {
          const response = await fetch("/api/albums");
          if (!response.ok || !active) return;
          const result = await response.json() as { albums: AlbumSummary[] };
          setAlbums(result.albums);
          setSelectedId(result.albums[0]?.id ?? null);
        }
      })
      .catch(() => { if (active) setAuthenticated(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    if (!selectedId) return () => { active = false; };
    fetch(`/api/albums/${selectedId}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("request failed")))
      .then((data: { album: AlbumDetail }) => { if (active) setSelected(data.album); })
      .catch(() => { if (active) setSelected(null); });
    return () => { active = false; };
  }, [selectedId]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoginError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    if (!response.ok) { setLoginError("登录信息不正确"); return; }
    setAuthenticated(true);
  }

  async function create(event: FormEvent) {
    event.preventDefault(); const name = newName.trim(); if (!name) return;
    const response = await fetch("/api/albums", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    if (response.ok) { const { album } = await response.json() as { album: AlbumSummary }; setNewName(""); await loadAlbums(); setSelectedId(album.id); }
  }

  async function rename() {
    if (!selected) return;
    const name = window.prompt("修改名称", selected.name)?.trim(); if (!name) return;
    await fetch(`/api/albums/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    await Promise.all([loadAlbums(), loadSelected()]);
  }

  async function removeAlbum() {
    if (!selected || !window.confirm(`确认删除相册“${selected.name}”及其中全部照片？此操作无法恢复。`)) return;
    await fetch(`/api/albums/${selected.id}`, { method: "DELETE" }); setSelected(null); setSelectedId(null); await loadAlbums();
  }

  async function logout() { await fetch("/api/admin/logout", { method: "POST" }); setAuthenticated(false); }

  if (authenticated === null) return <main className="admin-loading" aria-live="polite">正在验证管理员身份…</main>;
  if (!authenticated) return <main className="login-shell"><section className="login-card"><Link href="/" className="brand">拾光册</Link><p className="eyebrow">PRIVATE STUDIO</p><h1>管理员登录</h1><p>登录后管理相册与上传珍贵照片。</p><form onSubmit={login}><label>邮箱<input required name="email" type="email" autoComplete="username" /></label><label>密码<input required name="password" type="password" autoComplete="current-password" /></label>{loginError && <p role="alert" className="form-error">{loginError}</p>}<button className="primary-button">进入管理后台</button></form><Link className="back-link" href="/">← 返回公开相册</Link></section></main>;

  return <main className="admin-shell">
    <header className="admin-topbar"><Link className="brand" href="/">拾光册</Link><div><Link href="/">查看公开相册</Link><button onClick={() => void logout()}>退出登录</button></div></header>
    <div className="admin-layout">
      <aside className="album-sidebar">
        <div><p className="eyebrow">ALBUMS</p><h1>相册管理</h1></div>
        <form className="create-album" onSubmit={create}><input aria-label="新相册名称" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="输入相册名称" maxLength={80} /><button className="primary-button">新建相册</button></form>
        <nav aria-label="相册列表">{albums.map((album) => <button className={album.id === selectedId ? "selected" : ""} key={album.id} onClick={() => setSelectedId(album.id)}><span>{album.name}</span><small>{album.photoCount} 张</small></button>)}</nav>
      </aside>
      <section className="admin-workspace">
        {!selected ? <div className="admin-empty large"><h2>新建一本相册</h2><p>创建后即可批量上传照片。</p></div> : <>
          <header className="workspace-header"><div><p className="eyebrow">CURRENT ALBUM</p><h1>{selected.name}</h1><span>{selected.photoCount} 张照片</span></div><div><button onClick={() => void rename()}>修改名称</button><button className="danger-link" onClick={() => void removeAlbum()}>删除相册</button></div></header>
          <UploadQueue albumId={selected.id} onComplete={() => { void loadAlbums(); void loadSelected(); }} />
          <PhotoOrganizer key={`${selected.id}:${selected.photos.map((photo) => photo.id).join(",")}`} albumId={selected.id} coverPhotoId={selected.coverPhotoId} photos={selected.photos} onChange={() => { void loadAlbums(); void loadSelected(); }} />
        </>}
      </section>
    </div>
  </main>;
}
