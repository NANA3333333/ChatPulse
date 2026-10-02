const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const clientRequire = createRequire(path.join(root, 'client/package.json'));
const { parse } = clientRequire('@babel/parser');
const traverse = clientRequire('@babel/traverse').default;
const globals = clientRequire('globals');
const serverGlobals = { ...globals.node, ...globals.es2024, ...globals.nodeBuiltin };
const browserGlobals = { ...globals.browser, ...globals.es2024 };
const slash = value => value.replaceAll('\\', '/');

function filesIn(directory) {
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        if (['node_modules', 'dist', 'public', '.git'].includes(entry.name)) return [];
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? filesIn(target) : /\.(?:c?js|jsx|mjs)$/.test(entry.name) ? [target] : [];
    });
}

function inspectArchitecture() {
    const errors = [], routes = [];
    const files = ['client/src', 'server', 'scripts', 'desktop', 'tools/chatpulse-memory-mcp']
        .flatMap(directory => filesIn(path.join(root, directory)));
    for (const file of files) {
        const relative = slash(path.relative(root, file));
        const source = fs.readFileSync(file, 'utf8');
        let ast;
        let reportedJsxExtension = false;
        try { ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx'] }); }
        catch (error) { errors.push(`${relative}: ${error.message}`); continue; }
        function checkImport(value) {
            if (typeof value !== 'string' || !value.startsWith('.')) return;
            const target = path.resolve(path.dirname(file), value.split('?')[0]);
            if (!['', '.js', '.jsx', '.json', '.cjs', '.mjs', '/index.js', '/index.jsx'].some(extension => {
                const candidate = target + extension;
                return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
            })) errors.push(`${relative}: missing import ${value}`);
            const targetRelative = slash(path.relative(root, target));
            if (relative.startsWith('client/src/shared/') && /^client\/src\/(features|labs|app)\//.test(targetRelative)) {
                errors.push(`${relative}: shared code imports business code ${value}`);
            }
            if (relative.startsWith('client/src/features/') && targetRelative.startsWith('client/src/labs/')) {
                errors.push(`${relative}: production feature imports experimental UI ${value}`);
            }
            if (relative.startsWith('server/features/') && /server\/labs\//.test(targetRelative)
                && !relative.endsWith('/index.js')) {
                errors.push(`${relative}: business operations depend on a lab ${value}`);
            }
        }
        traverse(ast, {
            'JSXElement|JSXFragment'() {
                if (!reportedJsxExtension && relative.startsWith('client/src/') && file.endsWith('.js')) {
                    errors.push(`${relative}: JSX views must use the .jsx extension for the Vite build`);
                    reportedJsxExtension = true;
                }
            },
            ReferencedIdentifier(p) {
                // Playwright files include callbacks that execute in the browser.
                const knownGlobals = file.endsWith('.e2e.cjs') ? { ...serverGlobals, ...browserGlobals }
                    : relative.startsWith('server/') || file.endsWith('.cjs') ? serverGlobals : browserGlobals;
                if ((relative.startsWith('server/') || relative.startsWith('client/src/'))
                    && !p.scope.hasBinding(p.node.name) && !Object.hasOwn(knownGlobals, p.node.name)) {
                    errors.push(`${relative}:${p.node.loc.start.line}: undefined identifier ${p.node.name}`);
                }
            },
            ImportDeclaration(p) { checkImport(p.node.source.value); },
            ExportNamedDeclaration(p) { checkImport(p.node.source?.value); },
            ExportAllDeclaration(p) { checkImport(p.node.source.value); },
            CallExpression(p) {
                const { callee, arguments: args } = p.node;
                if (callee.name === 'require' || callee.type === 'Import'
                    || (callee.object?.name === 'require' && callee.property?.name === 'resolve')) checkImport(args[0]?.value);
                if (callee.type !== 'MemberExpression' || !['get', 'post', 'put', 'patch', 'delete'].includes(callee.property.name)) return;
                if (!/^(app|router|dependencies\.(app|router))$/.test(source.slice(callee.object.start, callee.object.end))) return;
                if (args.length < 2) return;
                const routePath = args[0].type === 'StringLiteral' ? args[0].value
                    : args[0].type === 'TemplateLiteral' ? args[0].quasis.map(q => q.value.cooked).join('{action}') : '';
                if (!routePath.startsWith('/')) return;
                if (/^server\/(app|index)\.js$/.test(relative)) errors.push(`${relative}: feature HTTP handler belongs in features/ or labs/`);
                if (!relative.startsWith('server/features/') && !relative.startsWith('server/labs/')) return;
                if (relative.includes('/tests/')) return;
                const feature = relative.split('/')[2];
                routes.push({ feature, method: callee.property.name.toUpperCase(), path: routePath.startsWith('/api/') ? routePath : `/api${routePath}`, file: relative });
            }
        });
    }
    for (const retired of ['server/db.js', 'server/engine.js', 'server/memory.js', 'server/contextBuilder.js', 'client/src/App.jsx']) {
        if (fs.existsSync(path.join(root, retired))) errors.push(`Retired business entry returned: ${retired}`);
    }
    const keys = new Set();
    for (const route of routes) {
        const key = `${route.method} ${route.path}`;
        if (keys.has(key)) errors.push(`Duplicate HTTP operation: ${key}`);
        keys.add(key);
    }
    return { files: files.length, routes: routes.sort((a, b) => a.feature.localeCompare(b.feature) || a.path.localeCompare(b.path) || a.method.localeCompare(b.method)), errors };
}

function renderRouteMap(routes) {
    return '# API 与功能对应表\n\n由 `npm run docs:routes` 从路由注册代码生成。`{action}` 表示私聊的 `reroll` / `version` 两个操作。\n\n'
        + '| 功能 | 方法 | 路径 | 实现 |\n| --- | --- | --- | --- |\n'
        + routes.map(route => `| ${route.feature} | ${route.method} | \`${route.path}\` | [${path.basename(route.file)}](../../${route.file}) |`).join('\n') + '\n';
}

if (require.main === module) {
    const result = inspectArchitecture();
    for (const error of result.errors) console.error(error);
    if (result.errors.length) process.exitCode = 1;
    else {
        if (process.argv.includes('--write-routes')) fs.writeFileSync(path.join(root, 'docs/features/api-map.md'), renderRouteMap(result.routes));
        console.log(`Architecture OK: ${result.files} source files; ${result.routes.length} route registrations.`);
    }
}
module.exports = { inspectArchitecture, renderRouteMap };
