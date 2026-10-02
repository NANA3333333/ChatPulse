// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getPhysicalCondition(character) {
    const energy = Number(character.energy ?? 100);
    const sleepDebt = Number(character.sleep_debt ?? 0);
    const health = Number(character.health ?? 100);
    const satiety = Number(character.satiety ?? 45);
    const stomachLoad = Number(character.stomach_load ?? 0);
    const stress = Number(character.stress ?? 20);
    const calories = Number(character.calories ?? 2000);

    let score = 0;
    if (energy <= 10) score += 5;
    else if (energy <= 25) score += 3;
    else if (energy <= 40) score += 1;

    if (sleepDebt >= 90) score += 4;
    else if (sleepDebt >= 75) score += 3;
    else if (sleepDebt >= 55) score += 1;

    if (health <= 25) score += 4;
    else if (health <= 45) score += 2;

    if (satiety <= 15 || calories <= 400) score += 2;
    else if (satiety <= 30 || calories <= 900) score += 1;

    if (stomachLoad >= 80) score += 2;
    else if (stomachLoad >= 60) score += 1;

    if (stress >= 85) score += 2;
    else if (stress >= 65) score += 1;

    if (score >= 9) {
        return {
            level: 'critical',
            label: '崩溃边缘',
            summary: '身体接近极限，注意力、耐心和判断力明显下滑。'
        };
    }
    if (score >= 6) {
        return {
            level: 'drained',
            label: '透支',
            summary: '明显透支，脑子发钝、身体沉，交流和活动都更吃力。'
        };
    }
    if (score >= 3) {
        return {
            level: 'tired',
            label: '疲惫',
            summary: '状态偏疲惫，专注、耐心和表达流畅度下降。'
        };
    }
    return {
        level: 'stable',
        label: '稳定',
        summary: '身体整体稳定，恢复、专注和表达基本正常。'
    };
}

function getEnergyHint(energy) {
    if (energy < 20) return '极低，反应慢、易烦。';
    if (energy < 35) return '偏低，长聊费劲。';
    if (energy > 85) return '很高，表达更顺。';
    if (energy > 70) return '不错，开口轻松。';
    return '';
}

function getSleepDebtHint(sleepDebt) {
    if (sleepDebt > 85) return '严重欠觉，脑钝易脆。';
    if (sleepDebt > 70) return '很缺觉，耐心下降。';
    if (sleepDebt > 40) return '有些欠觉。';
    return '';
}

function getHealthHint(health) {
    if (health < 25) return '很差，行动受影响。';
    if (health < 45) return '不适，恢复下降。';
    if (health > 80) return '稳定，恢复在线。';
    return '';
}

function getSatietyHint(satiety) {
    if (satiety < 20) return '很饿，易烦急。';
    if (satiety > 80) return '很饱，暂不受饿影响。';
    return '';
}

function getStomachLoadHint(stomachLoad) {
    if (stomachLoad > 80) return '很撑，发沉犯困。';
    if (stomachLoad > 55) return '有点撑，行动发笨。';
    return '';
}

function getPressureHint(level) {
    if (level >= 3) return '焦虑感较强。';
    if (level >= 1) return '有被冷落感。';
    return '';
}

function buildCompactEmotionImpact(emotionGuidance) {
    let block = '';
    block += `[角色当前心情名称（你自己，从上一轮 EMOTION_STATE 自动保存）]: ${emotionGuidance.emotion.state}\n`;
    block += dependencies.compactLine('角色当前心情对应感受（由当前名称自动生成）', emotionGuidance.feeling);
    block += '[状态使用方式]: 上面这些情绪只描述你自己此刻的身体和注意力感受，不是用户 Nana 的状态；不要把这些数值或状态说成用户身上的情况。\n';
    return block;
}

function buildCompactPhysicalFeeling(physicalGuidance) {
    let block = '';
    block += `[角色当前生理状态（你自己，不是用户）]: ${physicalGuidance.physical.label} ${physicalGuidance.physical.emoji}\n`;
    block += dependencies.compactLine('角色当前生理感受（你自己）', physicalGuidance.feeling);
    return block;
}

    return { getPhysicalCondition, getEnergyHint, getSleepDebtHint, getHealthHint, getSatietyHint, getStomachLoadHint, getPressureHint, buildCompactEmotionImpact, buildCompactPhysicalFeeling };
}

module.exports = { createModule };
