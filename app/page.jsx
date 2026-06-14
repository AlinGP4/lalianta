import { readFileSync } from "node:fs";
import path from "node:path";
import LandingInteractions from "./landing-interactions";

export const dynamic = "force-dynamic";

function getLandingMarkup() {
  const filePath = path.join(process.cwd(), "index.html");
  const html = readFileSync(filePath, "utf8");
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";

  return body
    .replace(/<script\b[^>]*src=["']script\.js["'][^>]*><\/script>/gi, "")
    .trim();
}

export default function LandingPage() {
  return (
    <>
      <div id="landing-root" dangerouslySetInnerHTML={{ __html: getLandingMarkup() }} />
      <LandingInteractions />
    </>
  );
}
