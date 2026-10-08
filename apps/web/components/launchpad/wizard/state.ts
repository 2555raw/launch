'use client';
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Chain, ProjectDTO } from '@launch/types';

export const STEPS = ['Chain & wallet', 'Token info', 'Logo', 'Review', 'Sign & create', 'Done'] as const;

export interface WizardState {
  projectId: string | null;
  step: number;
  chain: Chain;
  /** revoke mint authority / disable minting (fixed supply) */
  fixedSupply: boolean;
  /** Solana only: revoke freeze authority */
  revokeFreeze: boolean;
}

export interface PreparedLaunch {
  project: ProjectDTO;
  metadataUri: string;
  linkedWallets: string[];
  chain: { network: string; rpcUrl?: string; chainId?: number; name?: string; rpc?: string; explorer?: string; abi?: unknown; bytecode?: string };
}

/** Wizard state lives in the URL (?project=&step=&chain=&fixed=&freeze=) so a refresh resumes where the user left off. */
export function useWizardState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state = useMemo<WizardState>(() => {
    const step = Number(params.get('step') ?? '1');
    const chain = params.get('chain') === 'ROBINHOOD' ? 'ROBINHOOD' : 'SOLANA';
    return {
      projectId: params.get('project'),
      step: Number.isFinite(step) && step >= 1 && step <= STEPS.length ? step : 1,
      chain,
      fixedSupply: params.get('fixed') !== '0',
      revokeFreeze: params.get('freeze') !== '0',
    };
  }, [params]);

  const update = useCallback(
    (patch: Partial<WizardState>) => {
      const next = new URLSearchParams(params.toString());
      const merged = { ...state, ...patch };
      if (merged.projectId) next.set('project', merged.projectId);
      else next.delete('project');
      next.set('step', String(merged.step));
      next.set('chain', merged.chain);
      next.set('fixed', merged.fixedSupply ? '1' : '0');
      next.set('freeze', merged.revokeFreeze ? '1' : '0');
      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, state, router, pathname],
  );

  return { state, update };
}

export function defaultDecimals(chain: Chain): number {
  return chain === 'SOLANA' ? 9 : 18;
}
export function maxDecimals(chain: Chain): number {
  return chain === 'SOLANA' ? 9 : 18;
}
