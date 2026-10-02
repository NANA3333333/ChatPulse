import manifest from '../../../config/feature-manifest.json';
import { lazy } from 'react';
import { Activity, Building2, FlaskConical, Home, Store } from 'lucide-react';

const CityLog = lazy(() => import('../features/city/components/CityLog.jsx'));
const HousingSocialPanel = lazy(() => import('../features/housing/components/HousingSocialPanel.jsx'));
const McpLabPanel = lazy(() => import('../labs/mcp/McpLabPanel.jsx'));
const CommercialStreetPanel = lazy(() =>
    manifest.labs['scene-editor'].enabled
        ? import('../labs/scene-editor/CommercialStreetPanel.jsx')
        : import('../features/city/scene/CommercialStreetPanel.jsx'),
);
const PixelCottagePanel = lazy(() =>
    manifest.labs['scene-editor'].enabled
        ? import('../labs/scene-editor/PixelCottagePanel.jsx')
        : import('../features/city/scene/PixelCottagePanel.jsx'),
);

export const plugins = [
    {
        id: 'mcp_lab',
        lab: 'mcp',
        name_en: 'MCP Lab',
        name_zh: 'MCP 实验室',
        icon: FlaskConical,
        component: McpLabPanel,
        color: '#0f9f8f',
        position: 'experiment',
    },
    {
        id: 'housing_social',
        name_en: 'Housing',
        name_zh: '\u4f4f\u623f\u7cfb\u7edf',
        icon: Building2,
        component: HousingSocialPanel,
        color: 'var(--accent-color)',
        position: 'top',
    },
    {
        id: 'commercial_street',
        name_en: 'Commercial Street',
        name_zh: '\u5546\u4e1a\u8857',
        icon: Store,
        component: CommercialStreetPanel,
        color: '#f58bb8',
        position: 'top',
    },
    {
        id: 'pixel_cottage',
        name_en: 'Pixel Cottage',
        name_zh: '\u50cf\u7d20\u5c0f\u5c4b',
        icon: Home,
        component: PixelCottagePanel,
        color: '#f58bb8',
        position: 'top',
    },
    {
        id: 'city',
        name_en: 'City Log',
        name_zh: '\u5546\u4e1a\u8857\u65e5\u5fd7',
        icon: Activity,
        component: CityLog,
        color: 'var(--accent-color)',
        position: 'top',
    },
].filter((entry) => !entry.lab || manifest.labs[entry.lab]?.enabled === true);
