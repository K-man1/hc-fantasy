import {WebClient} from "@slack/web-api";
import {countMessagesSince, statusMessagePrefix} from "../src/countMessages.js";

const weekStartTimestamp = String(new Date("2026-10-04T00:00:00-04:00").getTime() / 1000);

export async function GET(): Promise<Response> {
    const slackToken = process.env.SLACK_BOT;
    const channelId = process.env.CHANNEL_ID;

    if (!slackToken || !channelId) {
        return Response.json({error: "Missing environment variables"}, {status: 500});
    }

    const client = new WebClient(slackToken);
    await client.conversations.join({channel: channelId});
    const auth = await client.auth.test();

    if (!auth.user_id) {
        return Response.json({error: "Slack did not return the bot user ID"}, {status: 500});
    }

    const result = await countMessagesSince(
        client,
        channelId,
        weekStartTimestamp,
        auth.user_id,
    );
    const text = `${statusMessagePrefix} ${result.messageCount}`;

    if (result.statusMessageTimestamp) {
        await client.chat.update({
            channel: channelId,
            ts: result.statusMessageTimestamp,
            text,
        });
    } else {
        await client.chat.postMessage({channel: channelId, text});
    }

    return Response.json({messageCount: result.messageCount});
}
