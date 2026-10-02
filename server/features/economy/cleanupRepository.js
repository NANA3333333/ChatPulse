// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function clearTransfers(charId) {
        dependencies.db.prepare('DELETE FROM private_transfers WHERE char_id = ? OR sender_id = ? OR recipient_id = ?').run(charId, charId, charId);
    }

    return { clearTransfers };
}

module.exports = { createModule };
