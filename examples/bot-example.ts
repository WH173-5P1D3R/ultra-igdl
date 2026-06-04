import { ultraigdl } from "ultra-igdl";

const ig = new ultraigdl({ cache: true, maxConcurrency: 50 });

export async function handleInstagramLink(url: string): Promise<string> {
  const result = await ig.download(url);

  if (result.code !== 200) {
    return `Error ${result.code}: ${"message" in result ? result.message : "Failed"}`;
  }

  const lines = result.media.map(
    (m, i) => `${i + 1}. [${m.type}] ${m.url}`
  );
  return [
    `@${result.username}`,
    result.caption || "(no caption)",
    ...lines,
  ].join("\n");
}

// Usage in a generic bot handler:
// const reply = await handleInstagramLink(userMessage);