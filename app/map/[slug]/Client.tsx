'use client';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/app/components/MapView'), { ssr: false });

export default function Client({ slug }: { slug: string }) {
  return <MapView slug={slug} />;
}
