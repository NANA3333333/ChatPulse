// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function ensureSocialHousingDb(db) {
    if (!db) return null;
    if (!db.socialHousing) {
        const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : db;
        db.socialHousing = dependencies.initSocialHousingDb(rawDb);
    }
    return db.socialHousing;
}

function buildHousingContextBlock(db, character) {
    try {
        const housingContext = ensureSocialHousingDb(db)?.getHousingContextForCharacter?.(character.id) || null;
        const socialClass = housingContext?.social_class || null;
        const socialClassLine = socialClass
            ? `[社会阶层]: ${socialClass.emoji || ''}${socialClass.name || socialClass.id} - ${socialClass.description || ''}\n`
            : '';
        return `\n[住房与阶层]\n${socialClassLine}${dependencies.buildHousingPromptBlock(db, character)}\n`;
    } catch (e) {
        return '';
    }
}

function getHousingContextSourceParts(db, character) {
    try {
        const runtimeContext = dependencies.getHousingRuntimeContext(db, character);
        const housingContext = ensureSocialHousingDb(db)?.getHousingContextForCharacter?.(character.id) || null;
        if (!housingContext?.binding?.housing_id) {
            return {
                status: 'homeless',
                has_housing: 0,
                housing: null,
                binding: null,
                social_class: housingContext?.social_class || null
            };
        }
        return {
            status: runtimeContext.status,
            has_housing: runtimeContext.hasHousing ? 1 : 0,
            binding: housingContext.binding,
            housing: housingContext.housing,
            social_class: housingContext.social_class
        };
    } catch (e) {
        return null;
    }
}

    return { ensureSocialHousingDb, buildHousingContextBlock, getHousingContextSourceParts };
}

module.exports = { createModule };
