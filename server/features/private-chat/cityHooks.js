// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function setCityReplyStateSyncCallback(cb) {
        dependencies.cityReplyStateSyncCallback = cb;
    }

function setCityReplyIntentCallback(cb) {
        dependencies.cityReplyIntentCallback = cb;
    }

function setCityReplyActionCallback(cb) {
        dependencies.cityReplyActionCallback = cb;
    }

    return { setCityReplyStateSyncCallback, setCityReplyIntentCallback, setCityReplyActionCallback };
}

module.exports = { createModule };
