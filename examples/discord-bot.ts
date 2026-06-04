/**
 * Discord bot example (requires discord.js — install separately)
 *
 * npm install discord.js ultra-igdl
 */
import { Client, GatewayIntentBits, Events } from "discord.js";
import { ultraigdl, isInstagramUrl } from "ultra-igdl";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const ig = new ultraigdl({ cache: true });

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const match = message.content.match(/https?:\/\/(?:www\.)?instagram\.com\/\S+/);
  if (!match || !isInstagramUrl(match[0])) return;

  const result = await ig.download(match[0]);
  if (result.code !== 200) {
    await message.reply(`Failed: ${"message" in result ? result.message : result.code}`);
    return;
  }

  const embed = {
    description: result.caption || undefined,
    fields: result.media.map((m, i) => ({
      name: `Media ${i + 1} (${m.type})`,
      value: m.url,
    })),
    footer: { text: `@${result.username}` },
  };

  await message.reply({ embeds: [embed] });
});

client.login(process.env.DISCORD_TOKEN);