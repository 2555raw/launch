'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Rocket, Search } from 'lucide-react';
import clsx from 'clsx';
import type { Chain, Paginated, ProjectDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { Empty, PageHeader, Spinner } from '@/components/ui/primitives';
import { ProjectCard } from '@/components/launchpad/project-card';

const SORTS = [
  { key: 'new', label: 'New' },
  { key: 'trending', label: 'Trending' },
  { key: 'volume', label: 'Volume' },
  { key: 'liquidity', label: 'Liquidity' },
  { key: 'marketcap', label: 'Market Cap' },
  { key: 'holders', label: 'Holders' },
] as const;
type SortKey = (typeof SORTS)[number]['key'];
const CHAINS: { key: Chain | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All chains' },
  { key: 'SOLANA', label: 'Solana' },
  { key: 'ROBINHOOD', label: 'Robinhood Chain' },
];

function Discovery() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const sort = (SORTS.find((s) => s.key === params.get('sort'))?.key ?? 'new') as SortKey;
  const chain = (CHAINS.find((c) => c.key === params.get('chain'))?.key ?? 'ALL') as Chain | 'ALL';
  const q = params.get('q') ?? '';
  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || (k === 'sort' && v === 'new') || (k === 'chain' && v === 'ALL')) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const query = useInfiniteQuery({
    queryKey: ['projects', sort, chain, q],
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ sort, limit: '24' });
      if (chain !== 'ALL') qs.set('chain', chain);
      if (q) qs.set('q', q);
      if (pageParam) qs.set('cursor', pageParam);
      return api<Paginated<ProjectDTO>>(`/launchpad/projects?${qs}`);
    },
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Token projects"
        subtitle="Every token launched here was created on chain by its creator's wallet and verified by the server. Market data comes from DexScreener when a pair exists."
        actions={
          <Link href="/launchpad/new" className="btn-primary">
            <Rocket size={16} /> Launch yours
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="scroll-thin flex gap-1 overflow-x-auto pb-1">
          {SORTS.map((s) => (
            <button key={s.key} onClick={() => setParam({ sort: s.key })} className={clsx('shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium transition', sort === s.key ? 'bg-ember-500/15 text-ember-300' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100')}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          <select className="input w-auto" value={chain} onChange={(e) => setParam({ chain: e.target.value })} aria-label="Chain filter">
            {CHAINS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <form
            className="relative w-full sm:w-72"
            onSubmit={(e) => {
              e.preventDefault();
              setParam({ q: search.trim() });
            }}
          >
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, symbol or address" />
          </form>
        </div>
      </div>

      {query.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> Loading projects…
        </div>
      ) : query.isError ? (
        <Empty title="Could not load projects" body={errorMessage(query.error)} action={<button className="btn-secondary" onClick={() => void query.refetch()}>Retry</button>} />
      ) : items.length === 0 ? (
        <Empty
          title={q ? `No projects match "${q}"` : 'No published projects yet'}
          body={q ? 'Try another name, symbol or token address.' : 'Be the first to launch a token.'}
          action={
            <Link href="/launchpad/new" className="btn-primary">
              <Rocket size={16} /> Create a token
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-2 text-xs text-slate-500">
            {total !== undefined ? `${total} project${total === 1 ? '' : 's'}` : `${items.length} loaded`} · sorted by {SORTS.find((s) => s.key === sort)?.label.toLowerCase()}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
          {query.hasNextPage && (
            <div className="mt-6 flex justify-center">
              <button className="btn-secondary" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                {query.isFetchingNextPage && <Spinner />} Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> Loading…
        </div>
      }
    >
      <Discovery />
    </Suspense>
  );
}
