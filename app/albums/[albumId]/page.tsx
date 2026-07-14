import { AlbumReader } from "../../components/AlbumReader";

export default async function AlbumPage({ params }: { params: Promise<{ albumId: string }> }) {
  return <AlbumReader albumId={(await params).albumId} />;
}
