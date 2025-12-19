import { notFound } from "next/navigation";
import type { Metadata } from "next";

type RouteParams = { slug?: string[] };
type PageContext = { params?: RouteParams | Promise<RouteParams> };

async function resolveParams(
  params?: RouteParams | Promise<RouteParams>
): Promise<RouteParams> {
  if (!params) return {};
  if (typeof (params as Promise<RouteParams>).then === "function") {
    return await (params as Promise<RouteParams>);
  }
  return params as RouteParams;
}

function buildTitle(slug: string[]): string {
  if (!slug.length) return "Documento";
  const fileName = slug[slug.length - 1];
  const withoutExt = fileName.replace(/\.[^/.]+$/, "");
  return withoutExt.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function generateMetadata(
  context: PageContext
): Promise<Metadata> {
  const resolvedParams = await resolveParams(context.params);
  const slug = resolvedParams.slug ?? [];
  const prettyTitle = buildTitle(slug);
  return {
    title: `${prettyTitle} | Documentos`,
    description: `Visualizador para ${prettyTitle}`,
  };
}

export default async function DocViewerPage(context: PageContext) {
  const resolvedParams = await resolveParams(context.params);
  const slug = resolvedParams.slug ?? [];
  if (!slug.length) {
    notFound();
  }

  const docPath = slug.join("/");
  const pdfUrl = `/api/docs/${docPath}`;

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b px-4 py-3">
        <p className="text-sm text-muted-foreground">Visualizando</p>
        <h1 className="text-lg font-semibold wrap-break-words">{buildTitle(slug)}</h1>
      </header>
      <section className="flex-1">
        <iframe
          title={`PDF ${docPath}`}
          src={pdfUrl}
          className="h-full w-full"
          style={{ minHeight: "calc(100vh - 64px)" }}
        />
      </section>
    </main>
  );
}
