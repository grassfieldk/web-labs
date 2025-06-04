import { NextRequest, NextResponse } from "next/server";
import HololistService, { SearchParams } from "@/services/hololist/hololistService";

export async function GET(req: NextRequest) {
  try {
    const searchParams: Partial<SearchParams> = {};
    req.nextUrl.searchParams.forEach((value, key) => {
      if (key in searchParams) {
        searchParams[key as keyof SearchParams] = value;
      }
    });

    const data = await HololistService.search(searchParams);

    return NextResponse.json(data);
  } catch (error) {
    return new NextResponse(error instanceof Error ? error.message : "Internal Server Error", {
      status: 500,
    });
  }
}
