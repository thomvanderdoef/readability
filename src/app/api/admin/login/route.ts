import { redirect } from "next/navigation";
import {
  getAdminSession,
  markAdminLoggedIn,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.ADMIN_PASSWORD_HASH?.trim()) {
    redirect("/admin/login?error=config");
  }

  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");

  if (!(await verifyAdminPassword(password))) {
    redirect("/admin/login?error=invalid");
  }

  const session = await getAdminSession();
  await markAdminLoggedIn(session);

  redirect("/");
}
