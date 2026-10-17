import type {WebClient} from "@slack/web-api";

type MessageCount = {
    messageCount: number;
    latestTimestamp: string;
};

export async function countMessagesSince(
    client: WebClient,
    channelId: string,
    oldest: string,
    botUserId: string,
): Promise<MessageCount> {
    let cursor: string | undefined;
    let messageCount = 0;
    let latestTimestamp = oldest;

    do {
        const page = await client.conversations.history({
            channel: channelId,
            oldest,
            limit: 200,
            ...(cursor ? {cursor} : {}),
        });

        for (const message of page.messages ?? []) {
            if (message.ts && Number(message.ts) > Number(latestTimestamp)) {
                latestTimestamp = message.ts;
            }

            if (message.user === botUserId) {
                continue;
            }

            messageCount += 1;
        }

        cursor = page.response_metadata?.next_cursor || undefined;
    } while (cursor);

    return {messageCount, latestTimestamp};
}
