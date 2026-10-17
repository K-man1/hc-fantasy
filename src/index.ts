import "dotenv/config";
import {readFile, writeFile} from "node:fs/promises";
import {WebClient} from "@slack/web-api";
import {countMessagesSince} from "./countMessages.js";

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
    const auth = await client.auth.test();

    if (!auth.user_id) {
        throw new Error("Slack did not return the bot user ID");
    }

    const state = await loadState();
    const result = await countMessagesSince(
        client,
        channelId,
        state.lastCheckedTimestamp,
        auth.user_id,
    );

    const updatedState: ChannelState = {
        channelId,
        messageCount: state.messageCount + result.messageCount,
        lastCheckedTimestamp: result.latestTimestamp,
    };

    await writeFile(statePath, `${JSON.stringify(updatedState, null, 2)}\n`);
    console.log(`${result.messageCount} new messages; ${updatedState.messageCount} total since October 4`);
}

await main();

