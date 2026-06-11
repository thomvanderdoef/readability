import { initialCollection, libraryName, resourceTypes } from "@/lib/library";

export function GET() {
  return Response.json({
    _about: "/llms.txt",
    name: libraryName,
    collections: [initialCollection],
    resourceTypes,
    status: "bootstrap",
  });
}
