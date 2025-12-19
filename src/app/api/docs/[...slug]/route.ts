import { NextResponse } from "next/server";
import path from "path";
import { stat } from "fs/promises";
import { createReadStream } from "fs";
import { Readable } from "stream";

type RouteParams = { slug?: string[] };

const PUBLIC_DOCS_DIR = path.join(process.cwd(), "src/lib/docs/public");
const PUBLIC_DOCS_DIR_WITH_SEP = `${PUBLIC_DOCS_DIR}${path.sep}`;

export async function GET(
  _request: Request,
  context: { params?: RouteParams | Promise<RouteParams> }
) {
  const params = await Promise.resolve(context.params);
  const slug = params?.slug;

  if (!slug || !slug.length) {
    return new NextResponse("Missing document path", { status: 400 });
  }

  const safePath = path.resolve(PUBLIC_DOCS_DIR, ...slug);
  if (!safePath.startsWith(PUBLIC_DOCS_DIR_WITH_SEP)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const fileInfo = await stat(safePath);
    if (!fileInfo.isFile()) {
      return new NextResponse("Not found", { status: 404 });
    }

    const fileStream = createReadStream(safePath);
    const readableStream = Readable.toWeb(fileStream) as ReadableStream<Uint8Array>;

    return new NextResponse(readableStream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": fileInfo.size.toString(),
        "Cache-Control": "private, max-age=0, must-revalidate",
        "Content-Disposition": `inline; filename="${slug[slug.length - 1]}"`,
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new NextResponse("Not found", { status: 404 });
    }
    console.error("[api/docs] Failed to stream file", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
