import { type NextRequest, NextResponse } from "next/server";
import HololistService, { type SearchParams } from "@/services/hololist/hololistService";

const searchParamKeys = [
  "s",
  "type",
  "category_name",
  "group",
  "link",
  "content",
  "language",
  "gender",
  "zodiac",
  "model",
  "status",
  "sort",
] as const satisfies readonly (keyof SearchParams)[];

function isSearchParamKey(key: string): key is keyof SearchParams {
  return (searchParamKeys as readonly string[]).includes(key);
}

export async function GET(req: NextRequest) {
  try {
    const searchParams: Partial<SearchParams> = {};
    req.nextUrl.searchParams.forEach((value, key) => {
      if (isSearchParamKey(key)) {
        searchParams[key] = value;
      }
    });

    const data = await HololistService.search(searchParams);

    return NextResponse.json(data);
  } catch (error) {
    return new NextResponse(
      error instanceof Error ? error.message : "Internal Server Error",
      {
        status: 500,
      }
    );
  }
}
