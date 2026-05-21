import { type NextRequest } from "next/server";
import { handleTimeseries } from "@/lib/api/timeseries-handler";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleTimeseries(req.url);
}
