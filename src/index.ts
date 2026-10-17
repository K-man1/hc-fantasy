import "dotenv/config";
import {readFile, writeFile} from "node:fs/promises";
import {WebClient} from "@slack/web-api";

function requireEnvironmentVariable(name: string): string {
    const value = process.env[name];

    if (value == undefined) {
        throw new Error(`${name} is undefined`);
    }

    return value;
}

const slackToken = requireEnvironmentVariable("SLACK_BOT");
const channelId = requireEnvironmentVariable("CHANNEL_ID");
const client = new WebClient(slackToken);
const statePath = new URL("../.fantasy-state.json", import.meta.url);
const weekStartTimestamp = String(new Date("2026-10-04T00:00:00-04:00").getTime() / 1000);

type ChannelState = {
    channelId: string;
    messageCount: number;
    lastCheckedTimestamp: string;
};

async function loadState(): Promise<ChannelState> {
    try {
        const savedState = JSON.parse(await readFile(statePath, "utf8")) as ChannelState;

        if (savedState.channelId !== channelId) {
            throw new Error("Saved state belongs to a different channel");
        }

        return savedState;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return {
                channelId,
                messageCount: 0,
                lastCheckedTimestamp: weekStartTimestamp,
            };
        }

        throw error;
    }
}

// async is important cuz the api returns a promise of a value, not the value immediately
// async lets me use await which waits for the api to return something then continue
async function main(): Promise<void> {
    await client.conversations.join({channel: channelId});
    const state = await loadState();
    let cursor: string | undefined;
    let newMessageCount = 0;
    let newestTimestamp = state.lastCheckedTimestamp;

    do {
        const page = await client.conversations.history({
            channel: channelId,
            oldest: state.lastCheckedTimestamp,
            limit: 200,
            ...(cursor ? {cursor} : {}),
        });
        const messages = page.messages ?? [];

        newMessageCount += messages.length;

        for (const message of messages) {
            if (message.ts && Number(message.ts) > Number(newestTimestamp)) {
                newestTimestamp = message.ts;
            }
        }

        cursor = page.response_metadata?.next_cursor || undefined;
    } while (cursor);

    const updatedState: ChannelState = {
        channelId,
        messageCount: state.messageCount + newMessageCount,
        lastCheckedTimestamp: newestTimestamp,

        
    };

    await client.chat.postMessage({
            channel: channelId,
            text: `# of messages since october 4th in #hc-fantasy: ${updatedState.messageCount}`
        })

    await writeFile(statePath, `${JSON.stringify(updatedState, null, 2)}\n`);
    console.log(`${newMessageCount} new messages; ${updatedState.messageCount} total since October 4`);
}

await main();

