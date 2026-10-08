import type { GameView } from "@/server/engine";
import type { GlobalSnapshot } from "@/server/global";
import type { PublicProject } from "@/server/project";
import type { ProjectData } from "@/server/projectData";

export type { GameView, GlobalSnapshot, PublicProject, ProjectData };

export interface PublicUser {
  id: string;
  username: string;
  role: string;
  wallets: string[];
}
