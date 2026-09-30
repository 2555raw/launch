import { UserProfileView } from "@/components/admin/UserProfileView";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserProfileView id={id} />;
}
