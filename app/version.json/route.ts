import { VERSION } from "@/lib/version";

// Statički fajl /version.json: aplikacija ga poredi sa svojom ugrađenom verzijom
export const dynamic = "force-static";

export function GET() {
  return Response.json({ version: VERSION });
}
