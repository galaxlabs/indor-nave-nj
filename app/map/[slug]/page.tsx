// app/map/[slug]/page.tsx
import MapView from '@/app/components/MapView';

export default function Page({ params }: { params: { slug: string } }) {
  return <MapView slug={params.slug} />;
}
