import express from "express";
import { ultraigdl } from "ultra-igdl";

const app = express();
const ig = new ultraigdl({ cache: true, maxConcurrency: 200 });

app.get("/health", async (_req, res) => {
  res.json(await ig.health());
});

app.get("/download", async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    res.status(400).json({ code: 400, message: "Missing url parameter" });
    return;
  }
  const result = await ig.download(url);
  res.status(result.code === 200 ? 200 : result.code).json(result);
});

app.post("/batch", express.json(), async (req, res) => {
  const urls: string[] = req.body?.urls ?? [];
  const results = await ig.batch(urls);
  res.json({ results });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));