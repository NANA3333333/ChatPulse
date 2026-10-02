const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

async function verifyStreetParallax(page, { checkLoopSeam = true } = {}) {
    const scene = page.locator('.right-column .pixel-world-editor');
    const toggle = scene.getByRole('button', { name: '视差实验', exact: true });
    const farItem = scene.locator('.active-loop [data-parallax-plane="far"]').first();
    const middleItem = scene.locator('.active-loop [data-parallax-plane="middle"]').first();
    const canvas = scene.locator('.pixel-world-editor-canvas-wrap');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    assert.ok(await farItem.count());
    assert.ok(await middleItem.count());
    const farStyle = await farItem.getAttribute('style');
    const middleStyle = await middleItem.getAttribute('style');

    await canvas.evaluate(async (wrap) => {
        const panelWidth = wrap.querySelector('.active-loop').getBoundingClientRect().width;
        wrap.scrollLeft = panelWidth + Math.min(1000, panelWidth / 3);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    await toggle.click();
    const positions = await canvas.evaluate(async (wrap) => {
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const sample = () => {
            const offset = (plane) => {
                const panel = wrap.querySelector(`[data-parallax-layer="${plane}"] .street-parallax-panel`);
                return new DOMMatrix(getComputedStyle(panel).transform).m41;
            };
            return { scroll: wrap.scrollLeft, far: offset('far'), middle: offset('middle') };
        };
        const initial = sample();
        wrap.scrollLeft += 200;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const first = sample();
        wrap.scrollLeft += 100;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { initial, first, second: sample() };
    });
    const firstCameraStep = positions.first.scroll - positions.initial.scroll;
    const secondCameraStep = positions.second.scroll - positions.first.scroll;
    const panelWidth = await scene.locator('.active-loop').evaluate((panel) => panel.getBoundingClientRect().width);
    const wrappedDelta = (from, to) => ((to - from + panelWidth / 2) % panelWidth + panelWidth) % panelWidth - panelWidth / 2;
    assert.ok(firstCameraStep > 50, `First camera step: ${JSON.stringify(positions)}`);
    assert.ok(secondCameraStep > 50, `Second camera step: ${JSON.stringify(positions)}`);
    assert.ok(Math.abs(wrappedDelta(positions.initial.far, positions.first.far) - firstCameraStep * 0.6) < 2, 'Far plane keeps a 0.4 scroll factor');
    assert.ok(Math.abs(wrappedDelta(positions.initial.middle, positions.first.middle) - firstCameraStep * 0.25) < 2, 'Middle plane keeps a 0.75 scroll factor');
    assert.ok(Math.abs(wrappedDelta(positions.first.far, positions.second.far) - secondCameraStep * 0.6) < 2, 'Far plane has constant speed');
    assert.ok(Math.abs(wrappedDelta(positions.first.middle, positions.second.middle) - secondCameraStep * 0.25) < 2, 'Middle plane has constant speed');
    assert.equal(await farItem.getAttribute('style'), farStyle, 'Far item world box remains fixed');
    assert.equal(await middleItem.getAttribute('style'), middleStyle, 'Middle item world box remains fixed');
    assert.equal(await farItem.locator('img').count(), 0, 'Original far image is not duplicated');
    if (process.env.CHATPULSE_PARALLAX_SCREENSHOT === '1') {
        const screenshotPath = path.join(os.tmpdir(), 'chatpulse-parallax-on.png');
        await canvas.screenshot({ path: screenshotPath });
        console.log(`Parallax screenshot: ${screenshotPath}`);
    }

    await canvas.focus();
    const player = scene.locator('.pixel-world-player.controlled').first();
    const initialPosition = await player.evaluate((node) => node.style.transform);
    for (const key of ['d', 's', 'a', 'w']) {
        await page.keyboard.down(key);
        await page.waitForTimeout(220);
        await page.keyboard.up(key);
        if ((await player.evaluate((node) => node.style.transform)) !== initialPosition) break;
    }
    assert.notEqual(await player.evaluate((node) => node.style.transform), initialPosition, 'Character walks');
    const farAfterWalk = await scene.locator('[data-parallax-layer="far"] .street-parallax-panel').first().evaluate((panel) => new DOMMatrix(getComputedStyle(panel).transform).m41);
    assert.notEqual(farAfterWalk, positions.second.far, 'Walking updates the far plane');
    if (process.env.CHATPULSE_PARALLAX_SCREENSHOT === '1') {
        await canvas.evaluate(async (wrap) => {
            const panelWidth = wrap.querySelector('.active-loop').getBoundingClientRect().width;
            wrap.scrollLeft = panelWidth * 2 - wrap.clientWidth * 0.6;
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        const seamPath = path.join(os.tmpdir(), 'chatpulse-parallax-seam.png');
        await canvas.screenshot({ path: seamPath });
        console.log(`Parallax seam screenshot: ${seamPath}`);
    }
    if (checkLoopSeam) {
        const loopWrap = await canvas.evaluate(async (wrap) => {
            const panelWidth = wrap.querySelector('.active-loop').getBoundingClientRect().width;
            const sample = () => ({
                scroll: wrap.scrollLeft,
                far: new DOMMatrix(getComputedStyle(wrap.querySelector('[data-parallax-layer="far"] .street-parallax-panel')).transform).m41,
                middle: new DOMMatrix(getComputedStyle(wrap.querySelector('[data-parallax-layer="middle"] .street-parallax-panel')).transform).m41,
            });
            wrap.scrollLeft = panelWidth * 2 + 100;
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const before = sample();
            await new Promise((resolve) => setTimeout(resolve, 360));
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            return { panelWidth, before, after: sample() };
        });
        assert.ok(Math.abs(loopWrap.after.scroll - (loopWrap.before.scroll - loopWrap.panelWidth)) < 2, 'Loop scroll recenters');
        assert.ok(Math.abs(wrappedDelta(loopWrap.before.far, loopWrap.after.far)) < 2, 'Far plane is continuous across the loop seam');
        assert.ok(Math.abs(wrappedDelta(loopWrap.before.middle, loopWrap.after.middle)) < 2, 'Middle plane is continuous across the loop seam');
    }

    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    assert.equal(await scene.locator('[data-parallax-layer]').count(), 0);
    assert.equal(await farItem.locator('img').count(), 1, 'Original far image returns when parallax is off');
    console.log('PASS street parallax: constant layer speeds, walking camera, fixed world boxes and off switch');
}

module.exports = { verifyStreetParallax };
