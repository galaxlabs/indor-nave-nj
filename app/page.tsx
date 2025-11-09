import Link from 'next/link';

export default function Home() {
  return (
    <main className="h-dvh flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-semibold">Indoor Nav</h1>
        <p className="text-slate-600">Open the demo map</p>
        <Link href="/map/demo" className="px-4 py-2 rounded-md bg-blue-600 text-white inline-block">
          Open Demo
        </Link>
      </div>
    </main>
  );
}
