'use client';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProjectDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useRequireAuth } from '@/lib/hooks';
import { Empty, PageHeader, Spinner } from '@/components/ui/primitives';
import { StatusPill } from '@/components/launchpad/common';
import { Stepper } from '@/components/launchpad/wizard/stepper';
import { STEPS, useWizardState, type PreparedLaunch } from '@/components/launchpad/wizard/state';
import { StepChain } from '@/components/launchpad/wizard/step-chain';
import { StepInfo } from '@/components/launchpad/wizard/step-info';
import { StepLogo } from '@/components/launchpad/wizard/step-logo';
import { StepReview } from '@/components/launchpad/wizard/step-review';
import { StepSign } from '@/components/launchpad/wizard/step-sign';
import { StepDone } from '@/components/launchpad/wizard/step-done';

function Wizard() {
  const user = useRequireAuth();
  const { state, update } = useWizardState();
  const [prepared, setPrepared] = useState<PreparedLaunch | null>(null);

  const projectQ = useQuery({
    queryKey: ['project', state.projectId],
    queryFn: () => api<{ project: ProjectDTO; transactions: unknown[] }>(`/launchpad/projects/${state.projectId}`),
    enabled: !!user && !!state.projectId,
  });
  const project = projectQ.data?.project ?? null;

  // Keep the URL chain in sync with the project and clamp the step to what the project allows.
  useEffect(() => {
    if (!project) return;
    const patch: Parameters<typeof update>[0] = {};
    if (project.chain !== state.chain) patch.chain = project.chain;
    if (project.status === 'PUBLISHED' && state.step !== 6) patch.step = 6;
    if (project.status !== 'PUBLISHED' && state.step === 6) patch.step = 5;
    if (Object.keys(patch).length) update(patch);
  }, [project, state.chain, state.step, update]);

  const go = useCallback((step: number) => update({ step }), [update]);
  const onPrepared = useCallback((p: PreparedLaunch) => setPrepared(p), []);
  const onPublished = useCallback((p: ProjectDTO) => update({ projectId: p.id, step: 6 }), [update]);

  if (!user) return null;
  const maxReachable = !project ? 2 : project.status === 'PUBLISHED' ? 6 : 5;
  const step = !project && state.step > 2 ? 1 : state.step;

  let body: React.ReactNode;
  if (state.projectId && projectQ.isLoading) {
    body = (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Spinner /> Loading project…
      </div>
    );
  } else if (state.projectId && projectQ.isError) {
    body = (
      <Empty
        title="Project not found"
        body={errorMessage(projectQ.error)}
        action={
          <Link href="/launchpad/new" className="btn-primary">
            Start a new project
          </Link>
        }
      />
    );
  } else if (step === 1) {
    body = <StepChain chain={state.chain} locked={!!project} onChange={(chain) => update({ chain })} onNext={() => go(2)} />;
  } else if (step === 2) {
    body = <StepInfo key={project?.id ?? 'new'} chain={state.chain} project={project} fixedSupply={state.fixedSupply} revokeFreeze={state.revokeFreeze} onFlags={(f) => update(f)} onSaved={(p) => update({ projectId: p.id, step: 3 })} onBack={() => go(1)} />;
  } else if (!project) {
    body = null;
  } else if (step === 3) {
    body = <StepLogo project={project} onBack={() => go(2)} onNext={() => go(4)} />;
  } else if (step === 4) {
    body = <StepReview project={project} fixedSupply={state.fixedSupply} revokeFreeze={state.revokeFreeze} prepared={prepared} onPrepared={onPrepared} onEdit={go} onBack={() => go(3)} onNext={() => go(5)} />;
  } else if (step === 5) {
    body = <StepSign project={project} fixedSupply={state.fixedSupply} revokeFreeze={state.revokeFreeze} prepared={prepared} onPrepared={onPrepared} onPublished={onPublished} onBack={() => go(4)} />;
  } else {
    body = <StepDone project={project} />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Create a token"
        subtitle={`Step ${step} of ${STEPS.length} · ${STEPS[step - 1]}`}
        actions={
          project && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="hidden sm:inline">{project.name}</span>
              <StatusPill status={project.status} />
            </div>
          )
        }
      />
      <Stepper current={step} maxReachable={maxReachable} onJump={go} />
      {body}
    </div>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> Loading…
        </div>
      }
    >
      <Wizard />
    </Suspense>
  );
}
