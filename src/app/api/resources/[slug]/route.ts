type Context = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, context: Context) {
  const { slug } = await context.params;

  return Response.json(
    {
      _about: "/llms.txt",
      slug,
      status: "bootstrap",
      message: "Resource detail storage will be wired in the read-path milestone.",
    },
    {
      status: 404,
    },
  );
}
