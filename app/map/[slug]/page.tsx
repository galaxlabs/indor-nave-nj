import { use } from 'react';
import MapView from '@/app/components/MapView';

export default function Page(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = use(params);    // ✅ unwrap via React.use()
  return <MapView slug={slug} />;
}

// // app/map/[slug]/page.tsx
// import MapView from '@/app/components/MapView';

// export default function Page({ params }: { params: { slug: string } }) {
//   return <MapView slug={params.slug} />;
// }
