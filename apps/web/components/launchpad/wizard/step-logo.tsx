'use client';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Upload } from 'lucide-react';
import type { ApiError, ProjectDTO } from '@launch/types';
import { API_URL } from '@/lib/config';
import { useAuth } from '@/lib/auth-store';
import { errorMessage, refreshAccessToken } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/primitives';
import { ProjectLogo } from '../common';

const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_BYTES = 2 * 1024 * 1024;

async function uploadLogo(projectId: string, file: File, token: string | null): Promise<ProjectDTO> {
  const send = async (bearer: string | null) => {
    const fd = new FormData();
    fd.append('logo', file, file.name);
    return fetch(`${API_URL}/launchpad/projects/${projectId}/logo`, { method: 'POST', body: fd, credentials: 'include', headers: bearer ? { authorization: `Bearer ${bearer}` } : {} });
  };
  let res = await send(token);
  if (res.status === 401) {
    const fresh = await refreshAccessToken();
    if (fresh) res = await send(fresh);
  }
  if (!res.ok) {
    let err: ApiError | null = null;
    try {
      err = (await res.json()) as ApiError;
    } catch {
      /* ignore */
    }
    throw new Error(err?.error.message ?? `Upload failed (${res.status})`);
  }
  return ((await res.json()) as { project: ProjectDTO }).project;
}

export function StepLogo({ project, onBack, onNext }: { project: ProjectDTO; onBack: () => void; onNext: () => void }) {
  const qc = useQueryClient();
  const accessToken = useAuth((s) => s.accessToken);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const pick = (f: File | null) => {
    setLocalError(null);
    if (preview) URL.revokeObjectURL(preview);
    if (!f) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (!ACCEPT.includes(f.type)) return setLocalError('Logo must be PNG, JPEG, WebP or SVG.');
    if (f.size > MAX_BYTES) return setLocalError('Logo must be under 2 MB.');
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const upload = useMutation({
    mutationFn: () => uploadLogo(project.id, file as File, accessToken),
    onSuccess: (p) => {
      qc.setQueryData(['project', p.id], (old: { project: ProjectDTO; transactions: unknown[] } | undefined) => ({ project: p, transactions: old?.transactions ?? [] }));
      toast.success('Logo uploaded');
      pick(null);
    },
    onError: (e) => toast.error('Upload failed', errorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">Logo</h2>
        <p className="mt-1 text-sm text-slate-400">Shown in discovery, on the project page and referenced from the token metadata. PNG, JPEG, WebP or SVG up to 2 MB; square images look best.</p>
      </div>

      <div className="card grid gap-6 p-4 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Logo preview" className="h-32 w-32 rounded-2xl object-cover" />
          ) : (
            <ProjectLogo logoUrl={project.logoUrl} name={project.name} symbol={project.symbol} size={128} />
          )}
          <div className="text-xs text-slate-500">{preview ? 'New (not uploaded yet)' : project.logoUrl ? 'Current logo' : 'No logo yet'}</div>
        </div>
        <div className="space-y-3">
          <input ref={inputRef} type="file" accept={ACCEPT.join(',')} className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          <button
            type="button"
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-sm text-slate-400 transition hover:border-ember-500/50 hover:text-slate-200"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pick(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            <ImagePlus size={22} />
            {file ? (
              <span className="text-slate-200">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </span>
            ) : (
              <span>Click to choose a file or drop it here</span>
            )}
          </button>
          {localError && <div className="text-xs text-rose-300">{localError}</div>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
              {upload.isPending ? <Spinner /> : <Upload size={16} />} Upload logo
            </button>
            {file && (
              <button type="button" className="btn-ghost" onClick={() => pick(null)}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button type="button" className="btn-ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn-primary" onClick={onNext} disabled={upload.isPending}>
          {project.logoUrl ? 'Continue' : 'Skip for now'}
        </button>
      </div>
    </div>
  );
}
