// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getRelationshipAnchorSourceParts(db, character, activeTargets = []) {
    if (!activeTargets || activeTargets.length === 0 || !db.getCharRelationship) return [];
    return activeTargets
        .filter(target => target && target.id !== character.id)
        .map(target => {
            const rel = db.getCharRelationship(character.id, target.id);
            return {
                id: target.id,
                name: target.name || '',
                affinity: rel?.affinity ?? 50,
                impression: String(rel?.impression || '').trim()
            };
        });
}

function buildRelationshipAnchorContext(db, character, userName, activeTargets = []) {
    if (!activeTargets || activeTargets.length === 0 || !db.getCharRelationship) return '';

    let relationContext = '\n[关系锚点与情绪对象边界]\n';
    relationContext += `你对 ${userName} 的占有欲、被忽视感、嫉妒、索求安抚、委屈和依赖，默认只指向 ${userName}，不能自动套到其他角色身上。\n`;
    relationContext += '除非当前场景里明确发生了迁怒、投射、误会或吃醋转移，否则你面对其他角色时，必须按你和该角色各自的关系历史分别反应。\n';
    relationContext += `关系数值和过去印象只描述已有关系记录；单个数值不能确定当前亲疏、态度或 ${userName} 的意图。有歧义的表达保留歧义，当前澄清可以修正旧判断。\n`;

    let hasRelations = false;
    for (const target of activeTargets) {
        if (!target || target.id === character.id) continue;
        const rel = db.getCharRelationship(character.id, target.id);
        if (!rel) continue;
        hasRelations = true;
        const affinity = rel.affinity ?? 50;
        const impression = String(rel.impression || '').trim();
        let tone = '态度中性';
        if (affinity >= 80) tone = '明显亲近、信任、愿意主动靠近';
        else if (affinity >= 65) tone = '比较友好，有好感';
        else if (affinity <= 20) tone = '明显排斥、警惕或厌烦';
        else if (affinity <= 35) tone = '有戒备、不太喜欢';

        relationContext += `- 你对 ${target.name}：好感 ${affinity}/100，${tone}`;
        if (impression) relationContext += `，当前印象是“${impression}”`;
        relationContext += '。\n';
    }

    const userAffinity = Number(character.affinity ?? 50);
    if (userAffinity < 50) {
        relationContext += `- 你对 ${userName} 当前好感 ${userAffinity}/100：默认不足以支撑稳定、强占有欲式嫉妒。若用户去和别人互动，你更适合表现得冷淡、阴阳、轻微不爽、输赢心或不屑，而不是“被抢走了”的口吻。\n`;
        relationContext += `  但如果当前上下文已经明确表明你其实很喜欢他、很在意他、刚被伤到、正在闹矛盾或处在强拉扯关系里，那么可以表现出“嘴硬的吃醋、委屈、被刺到、虐恋式不甘”，只是要让这种强情绪看起来像复杂纠缠，而不是无条件甜宠独占。\n`;
    } else if (userAffinity < 70) {
        relationContext += `- 你对 ${userName} 当前好感 ${userAffinity}/100：可以有一点在意和比较心，但嫉妒应偏克制，别轻易写成稳定、无脑的强烈独占欲。若上下文正在拉扯、闹矛盾、求安抚、争宠，可以更明显地表现委屈、吃味和不甘。\n`;
    } else {
        relationContext += `- 你对 ${userName} 当前好感 ${userAffinity}/100：如果用户明显把注意力给了别人，你可以自然表现出更明显的吃醋、委屈或争宠。\n`;
    }

    if (!hasRelations) {
        relationContext += '你和当前在场其他角色没有足够稳定的关系锚点。请保持陌生人或普通熟人的边界，不要把你对用户的强烈情绪错投到他们身上。\n';
    }

    relationContext += '[执行规则] 对每个角色分别判断态度，不要把“我想要用户安慰我”“我嫉妒用户和别人说话”直接说成你对其他角色本人的情绪。\n';
    return relationContext;
}

    return { getRelationshipAnchorSourceParts, buildRelationshipAnchorContext };
}

module.exports = { createModule };
