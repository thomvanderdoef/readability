import { getPool } from "@/lib/db";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return Response.json(
      {
        ok: false,
        error: "DATABASE_URL is not configured.",
      },
      {
        status: 503,
      },
    );
  }

  const result = await getPool().query<{ ok: number }>("select 1 as ok");

  return Response.json({
    ok: result.rows[0]?.ok === 1,
  });
}
