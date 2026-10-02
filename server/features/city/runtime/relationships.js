// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
async function checkSocialCollisions(characters, db, userId, districts, config, minuteKey) {
        return dependencies.socialService.checkSocialCollisions(characters, db, userId, districts, config, minuteKey);
    }

async function runSocialEncounter(occupants, district, db, userId, yLimit) {
        return dependencies.socialService.runSocialEncounter(occupants, district, db, userId, yLimit);
    }

    return { checkSocialCollisions, runSocialEncounter };
}

module.exports = { createModule };
