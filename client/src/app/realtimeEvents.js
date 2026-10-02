import { handleEvent as handle0 } from "../features/private-chat/realtimeEvents";
import { handleEvent as handle1 } from "../features/speech/realtimeEvents";
import { handleEvent as handle2 } from "../features/group-chat/realtimeEvents";
import { handleEvent as handle3 } from "../features/economy/realtimeEvents";
import { handleEvent as handle4 } from "../features/characters/realtimeEvents";
import { handleEvent as handle5 } from "../features/admin/realtimeEvents";
import { handleEvent as handle6 } from "../features/memory/realtimeEvents";
import { handleEvent as handle7 } from "../features/city/realtimeEvents";

const handlers = [handle0, handle1, handle2, handle3, handle4, handle5, handle6, handle7];
export function dispatchRealtimeEvent(message, dependencies) {
    return handlers.some(handle => handle(message, dependencies));
}
