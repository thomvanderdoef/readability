import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getAdminSession();
  session.destroy();

  redirect("/");
}
