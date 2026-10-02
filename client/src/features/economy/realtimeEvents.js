// Feature-owned reactions to server events. State setters are supplied by the app.
export function handleEvent(message, dependencies) {
    const msg = message;
    switch (msg.type) {
        case "wallet_sync": {

            const { characterId, characterWallet, userWallet } = msg.data;
            if (characterId && characterWallet !== null && characterWallet !== undefined) {
              dependencies.setContacts(prev => prev.map(c => c.id === characterId ? { ...c, wallet: characterWallet } : c));
            }
            if (userWallet !== null && userWallet !== undefined) {
              dependencies.setUserProfile(prev => prev ? { ...prev, wallet: userWallet } : prev);
            }
          
            return true;
        }
        case "redpacket_claim": {

            dependencies.setRedpacketClaimEvent({ ...msg.data, _ts: Date.now() });
          
            return true;
        }
        default: return false;
    }
}
