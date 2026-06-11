import { initialCollection, libraryName } from "@/lib/library";

export function GET() {
  const body = `# ${libraryName} Export

Bootstrap export placeholder for ${initialCollection.name}.

The full markdown export will be wired after database reads and link-key access control are implemented.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
