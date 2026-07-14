import Link from "next/link";

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
      <section className="empty-albums" aria-live="polite">
        <span aria-hidden="true">◇</span>
        <h2>相册正在等待第一段故事</h2>
        <p>管理员上传照片后，相册会陈列在这里。</p>
      </section>
    </main>
  );
}
