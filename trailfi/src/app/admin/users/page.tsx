import { Suspense } from "react";
import { UsersView } from "@/components/admin/UsersView";

export default function AdminUsersPage() {
  return (
    <Suspense>
      <UsersView />
    </Suspense>
  );
}
