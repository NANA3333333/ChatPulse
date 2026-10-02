const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

function metricMap(metrics) {
    return Object.fromEntries(metrics.map(({ name, value }) => [name, value]));
}

async function measureWalk(page, key) {
    const canvas = page.locator('.right-column .pixel-world-editor-canvas-wrap');
    await canvas.focus();
    const session = await page.context().newCDPSession(page);
    await session.send('Performance.enable');
    const before = metricMap((await session.send('Performance.getMetrics')).metrics);
    if (key) await page.keyboard.down(key);
    const data = await canvas.evaluate(async (wrap) => {
        const node = wrap.querySelector('.active-loop .pixel-world-player.controlled');
        const samples = [];
        const started = performance.now();
        await new Promise((resolve) => {
            function tick(time) {
                samples.push({ time, x: new DOMMatrix(node.style.transform).m41, scroll: wrap.scrollLeft, sprite: node.currentSrc });
                if (time - started < 1800) requestAnimationFrame(tick);
                else resolve();
            }
            requestAnimationFrame(tick);
        });
        return { samples, images: wrap.querySelectorAll('img').length };
    });
    if (key) await page.keyboard.up(key);
    const after = metricMap((await session.send('Performance.getMetrics')).metrics);
    await session.detach();
    const samples = data.samples;
    assert.ok(samples.length > 2, 'Walking produced animation frames');
    const first = samples[0];
    const last = samples.at(-1);
    const durations = samples.slice(1).map((sample, index) => sample.time - samples[index].time).sort((a, b) => a - b);
    const seconds = (last.time - first.time) / 1000;
    return {
        frames: samples.length,
        seconds: Number(seconds.toFixed(2)),
        medianMs: Number(durations[Math.floor(durations.length / 2)].toFixed(1)),
        p95Ms: Number(durations[Math.floor(durations.length * 0.95)].toFixed(1)),
        over50Ms: durations.filter((duration) => duration > 50).length,
        worldPixels: Number((last.x - first.x).toFixed(1)),
        worldPixelsPerSecond: Number((Math.abs(last.x - first.x) / seconds).toFixed(1)),
        cameraPixels: Number((last.scroll - first.scroll).toFixed(1)),
        spriteChanges: samples.slice(1).filter((sample, index) => sample.sprite !== samples[index].sprite).length,
        images: data.images,
        scriptMs: Number(((after.ScriptDuration - before.ScriptDuration) * 1000).toFixed(1)),
        layoutMs: Number(((after.LayoutDuration - before.LayoutDuration) * 1000).toFixed(1)),
        styleMs: Number(((after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000).toFixed(1)),
        taskMs: Number(((after.TaskDuration - before.TaskDuration) * 1000).toFixed(1)),
    };
}

async function verifyStreetPerformance(page) {
    const scene = page.locator('.right-column .pixel-world-editor');
    await scene.locator('.scene-player-toolbar__more > summary').click();
    const toggle = scene.getByRole('button', { name: '视差实验', exact: true });
    await scene.locator('.active-loop .pixel-world-player.controlled').first().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.right-column .pixel-world-editor-canvas-wrap img')].every((img) => img.complete));
    await page.waitForTimeout(500);
    console.log(`STREET_RENDER_STYLE ${JSON.stringify(await page.evaluate(() => {
        const wallpaper = document.querySelector('.desktop-wallpaper-backdrop .desktop-live2d-wallpaper');
        const underlay = document.querySelector('.desktop-home-underlay');
        const desktop = underlay?.querySelector('.desktop-home');
        const icon = underlay?.querySelector('.desktop-app');
        return {
            wallpaperChildren: wallpaper?.children.length ?? null,
            underlayNodes: underlay?.querySelectorAll('*').length ?? null,
            underlayAnimation: underlay ? getComputedStyle(underlay).animationName : null,
            desktopAnimation: desktop ? getComputedStyle(desktop).animationName : null,
            iconTransform: icon ? getComputedStyle(icon).transform : null,
            iconWillChange: icon ? getComputedStyle(icon).willChange : null,
        };
    }))}`);
    if (process.env.CHATPULSE_PERF_SCREENSHOT === '1') {
        await page.screenshot({ path: path.join(os.tmpdir(), 'chatpulse-street-performance-scene.png') });
    }
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    const results = [];
    for (let pair = 0; pair < 2; pair += 1) {
        results.push({ mode: 'on', ...await measureWalk(page, 'a') });
        await toggle.click();
        await page.waitForTimeout(300);
        results.push({ mode: 'off', ...await measureWalk(page, 'd') });
        await toggle.click();
        await page.waitForTimeout(300);
    }
    results.forEach((result) => console.log(`STREET_PERFORMANCE ${JSON.stringify(result)}`));
    console.log(`STREET_PERFORMANCE ${JSON.stringify({ mode: 'idle', ...await measureWalk(page, null) })}`);
    const root = page.locator('#root');
    await root.evaluate((node) => { node.style.display = 'none'; });
    const blankFrames = await page.evaluate(async () => {
        const values = [];
        const started = performance.now();
        await new Promise((resolve) => {
            function tick(time) {
                values.push(time);
                if (time - started < 1800) requestAnimationFrame(tick);
                else resolve();
            }
            requestAnimationFrame(tick);
        });
        return values;
    });
    console.log(`HIDDEN_ROOT_PERFORMANCE ${JSON.stringify({ frames: blankFrames.length, seconds: Number(((blankFrames.at(-1) - blankFrames[0]) / 1000).toFixed(2)) })}`);
}

module.exports = { verifyStreetPerformance };
