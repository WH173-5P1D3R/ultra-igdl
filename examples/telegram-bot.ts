/**
 * Telegram bot example (requires telegraf — install separately in your bot project)
 *
 * npm install telegraf ultra-igdl
 */
import { Telegraf } from "telegraf";
import { ultraigdl } from "ultra-igdl";
import { isInstagramUrl } from "ultra-igdl";

const bot = new Telegraf(process.env.BOT_TOKEN!);
const ig = new ultraigdl({ cache: true, maxConcurrency: 100 });

bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  if (!isInstagramUrl(text)) return;

  await ctx.reply("⏳ Fetching media…");
  const result = await ig.download(text);

  if (result.code !== 200) {
    await ctx.reply(`❌ ${"message" in result ? result.message : "Failed"}`);
    return;
  }

  for (const item of result.media) {
    if (item.type === "video") {
      await ctx.replyWithVideo(item.url, { caption: result.caption });
    } else {
      await ctx.replyWithPhoto(item.url, { caption: result.caption });
    }
  }
});

bot.launch();