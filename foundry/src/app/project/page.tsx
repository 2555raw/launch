import { redirect } from "next/navigation";
import { getCurrentProject } from "@/server/project";

export const dynamic = "force-dynamic";

export default async function ProjectIndex() {
  const p = await getCurrentProject();
  redirect(`/project/${p.slug}`);
}
