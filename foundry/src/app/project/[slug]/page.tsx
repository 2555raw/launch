import { notFound } from "next/navigation";
import { getProjectData } from "@/server/projectData";
import { ProjectView } from "@/components/project/ProjectView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const d = await getProjectData(params.slug);
  if (!d) return { title: "Project not found — FOUNDRY" };
  return { title: `$${d.project.symbol} — ${d.project.name} · FOUNDRY`, description: `${d.project.commodity} commodity token. ${d.global.burnPercent.toFixed(2)}% of the supply burned by the community.` };
}

export default async function ProjectPage({ params }: { params: { slug: string } }) {
  const data = await getProjectData(params.slug);
  if (!data) notFound();
  return <ProjectView initial={data} />;
}
