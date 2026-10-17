import Link from "next/link";
import { DRAFT_BANNER } from "@/lib/legal-copy";

type Block =
  | { type: "banner" }
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

function parse(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push({ type: "p", text: paragraph.join(" ") });
    paragraph = [];
  }

  function flushList() {
    if (list.length === 0) return;
    blocks.push({ type: "ul", items: list });
    list = [];
  }

  for (const raw of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line === DRAFT_BANNER) {
      flushParagraph();
      flushList();
      blocks.push({ type: "banner" });
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h3", text: line.slice(4) });
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h2", text: line.slice(3) });
      continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h1", text: line.slice(2) });
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2));
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

function inline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\[[^\]\n]+\])/g);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const [, label, href] = link;
      if (href?.startsWith("/")) {
        return (
          <Link key={key} href={href} className="font-bold text-clay underline">
            {label}
          </Link>
        );
      }
      return (
        <a key={key} href={href} className="font-bold text-clay underline">
          {label}
        </a>
      );
    }
    if (part.startsWith("[") && part.endsWith("]")) {
      return (
        <mark key={key} className="rounded bg-[#fff3bf] px-1 font-bold text-ink">
          {part}
        </mark>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

export function LegalDocument({ markdown }: { markdown: string }) {
  const blocks = parse(markdown);
  return (
    <article className="space-y-4 text-base leading-7">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "banner") {
          return (
            <p key={key} data-testid="legal-banner" className="rounded-2xl bg-[#fff3bf] px-4 py-3 text-sm font-extrabold text-[#5c4310]">
              {DRAFT_BANNER}
            </p>
          );
        }
        if (block.type === "h1") {
          return (
            <h1 key={key} className="text-3xl font-extrabold leading-tight">
              {inline(block.text, key)}
            </h1>
          );
        }
        if (block.type === "h2") {
          return (
            <h2 key={key} className="pt-2 text-2xl font-extrabold">
              {inline(block.text, key)}
            </h2>
          );
        }
        if (block.type === "h3") {
          return (
            <h3 key={key} className="pt-1 text-xl font-extrabold">
              {inline(block.text, key)}
            </h3>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={key} className="list-disc space-y-2 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{inline(item, `${key}-${itemIndex}`)}</li>
              ))}
            </ul>
          );
        }
        return <p key={key}>{inline(block.text, key)}</p>;
      })}
    </article>
  );
}
