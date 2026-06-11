export function GET() {
  return Response.json({
    _about: "/llms.txt",
    resources: [],
    status: "bootstrap",
  });
}
