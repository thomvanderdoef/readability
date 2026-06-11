import {
  aboutUrlFor,
  hasLibraryRequestAccess,
  unauthorizedJson,
} from "@/lib/access";
import { libraryName, resourceTypes } from "@/lib/library";
import { getLibraryMeta } from "@/lib/resources";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasLibraryRequestAccess(request)) {
    return unauthorizedJson();
  }

  const collections = await getLibraryMeta();

  return Response.json({
    _about: aboutUrlFor(request),
    name: libraryName,
    collections,
    resourceTypes,
    status: "ok",
  });
}
