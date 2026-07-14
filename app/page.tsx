import Link from "next/link";
import { AlbumGrid } from "./components/AlbumGrid";

export default function Home() {
  return (
    <main className="home-shell">
      <nav className="topbar" aria-label="主导航">
        <Link className="brand" href="/">拾光册</Link>
        <Link className="admin-link" href="/admin">管理员入口</Link>
      </nav>
      <section className="hero">
        <p className="eyebrow">OUR PHOTO STORIES</p>
        <h1>把日子，装订成册</h1>
        <p>每一次翻页，都是与珍贵时光的再次相遇。</p>
      </section>
      <AlbumGrid />
    </main>
  );
}
