import { initialCollection, libraryName, resourceTypes } from "@/lib/library";

export function GET() {
  const body = `# ${libraryName}

${libraryName} is a private, AI-legible personal research library.

The initial research collection is "${initialCollection.name}" (${initialCollection.slug}).

Available resource types: ${resourceTypes.join(", ")}.

Planned endpoints:
- /api/meta
- /api/resources
- /api/resources/{slug}
- /export.md

All read endpoints require the owner's link key in the V1 implementation.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
