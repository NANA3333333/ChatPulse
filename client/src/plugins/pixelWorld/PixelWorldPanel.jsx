import React, { useMemo, useState } from 'react';
import { commercialV2BehaviorConfigStorageKey } from './behaviorTreeCore';
import './PixelWorldPanel.css';
import CommercialStreetEditor from './CommercialStreetEditor';
import RoomAssetEditor from './RoomAssetEditor';
import {
  commercialV2StorageKey,
  commercialV2CanvasStorageKey,
  commercialV2ResetBackupStorageKey,
  commercialV2DefaultSnapshotStorageKey
} from './commercialStreetCore';
import {
  roomScenes,
  roomStyleMeta,
  roomEditorPlayerStorageKey
} from './roomEditorCore';

const assetBase = '/assets/pixel-world/kenney-rpg-urban';
const generatedBase = '/assets/pixel-world/generated-commercial';
const tile = (id) => `${assetBase}/tiles/tile_${id}.png`;
const generatedAsset = (path) => `${generatedBase}/${path}`;
const resolveImage = (id) => {
  const value = String(id);
  if (value.startsWith('/assets/')) return value;
  return value.includes('/') || value.endsWith('.png') ? generatedAsset(value) : tile(value);
};

const scenes = {
  street: {
    title: '繁华商业街',
    subtitle: '商业街 / 中介所 / 餐厅 / 便利店',
    source: 'AI 生成拆解素材 / 本地透明 PNG / 64x64 地面 tile',
    assetNote: '商业街概念图拆解后的本地素材：建筑、街道道具、地面 tile 与围栏。人物素材先暂时舍弃。',
    size: { cols: 26, rows: 17 },
    base: 'tiles/tile_pavement.png',
    palette: {
      g: 'tiles/tile_grass.png',
      f: 'tiles/tile_flower_grass.png',
      p: 'tiles/tile_pavement.png',
      s: 'tiles/tile_stone_path.png',
      r: 'tiles/tile_road_soft.png',
      x: 'tiles/tile_crosswalk.png',
      w: 'tiles/tile_water.png',
      b: 'tiles/tile_wood_plank.png'
    },
    map: [
      'ggggggppppppppppppgggggg',
      'ggggggppppppppppppgggggg',
      'ggggggppppppppppppgggggg',
      'pppppppppppppppppppppppppp',
      'pppppppppppppppppppppppppp',
      'rrrrrrrrrrrrrrrrrrrrrrrrrr',
      'rrxxxrrrrrrrrrxxxrrrrrrrr',
      'rrrrrrrrrrrrrrrrrrrrrrrrrr',
      'pppppppppppppppppppppppppp',
      'gggffffppppppppppffffggg',
      'pppppppppppppppppppppppppp',
      'pppppppppppppppppppppppppp',
      'ggggggppppppppppppgggggg',
      'ggggggppppppppppppgggggg',
      'ggggggppppbbbbbbppppgggggg',
      'wwwwwwwwwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwwwww'
    ],
    structures: [],
    props: [
      { id: 'pink-shop', asset: 'game-ready/building_pink_shop.png', x: 0.7, y: 0.15, w: 7, h: 6 },
      { id: 'convenience', asset: 'game-ready/building_green_convenience.png', x: 8.85, y: 0.1, w: 7.8, h: 6.15 },
      { id: 'blue-cafe', asset: 'game-ready/building_blue_cafe.png', x: 18.2, y: 0.15, w: 7, h: 6 },
      { id: 'tree-1', asset: 'game-ready/prop_tree_green.png', x: 0.2, y: 8.2, w: 2, h: 2.7 },
      { id: 'tree-2', asset: 'game-ready/prop_tree_cherry.png', x: 22.6, y: 8.1, w: 2.2, h: 2.8 },
      { id: 'lamp-1', asset: 'game-ready/prop_street_lamp.png', x: 7.3, y: 5.25, w: 0.9, h: 2.7 },
      { id: 'lamp-2', asset: 'game-ready/prop_street_lamp.png', x: 17.4, y: 5.25, w: 0.9, h: 2.7 },
      { id: 'led-24h', asset: 'game-ready/prop_led_24h.png', x: 8.15, y: 3.65, w: 0.55, h: 1.6 },
      { id: 'vending', asset: 'game-ready/prop_vending_machine.png', x: 16.95, y: 4.25, w: 0.9, h: 2.15 },
      { id: 'flower-box-1', asset: 'game-ready/prop_flower_box.png', x: 10.8, y: 8.75, w: 3, h: 2.1 },
      { id: 'cafe-table', asset: 'game-ready/prop_cafe_table.png', x: 20.2, y: 6.65, w: 2, h: 2.3 },
      { id: 'bench-1', asset: 'game-ready/prop_bench.png', x: 18.8, y: 9.5, w: 2.8, h: 1.6 },
      { id: 'fruit-stall', asset: 'game-ready/prop_fruit_stall.png', x: 2.6, y: 11.4, w: 3.3, h: 2.5 },
      { id: 'bicycle', asset: 'game-ready/prop_bicycle.png', x: 19.8, y: 6.8, w: 2.8, h: 1.8 },
      { id: 'mailbox', asset: 'game-ready/prop_mailbox.png', x: 23.6, y: 5.9, w: 1.1, h: 2.2 },
      { id: 'chalkboard', asset: 'game-ready/prop_chalkboard.png', x: 5.85, y: 4.55, w: 1.5, h: 1.8 },
      { id: 'fence-a', asset: 'tiles/fence_horizontal.png', x: 0, y: 11, w: 1, h: 1 },
      { id: 'fence-b', asset: 'tiles/fence_horizontal.png', x: 1, y: 11, w: 1, h: 1 },
      { id: 'fence-c', asset: 'tiles/fence_gate.png', x: 2, y: 11, w: 1, h: 1 },
      { id: 'fence-d', asset: 'tiles/fence_horizontal.png', x: 3, y: 11, w: 1, h: 1 },
      { id: 'fence-e', asset: 'tiles/fence_horizontal.png', x: 4, y: 11, w: 1, h: 1 },
      { id: 'railing-1', asset: 'tiles/railing_horizontal.png', x: 10, y: 14.4, w: 1, h: 1 },
      { id: 'railing-2', asset: 'tiles/railing_horizontal.png', x: 11, y: 14.4, w: 1, h: 1 },
      { id: 'railing-3', asset: 'tiles/railing_horizontal.png', x: 12, y: 14.4, w: 1, h: 1 },
      { id: 'railing-4', asset: 'tiles/railing_horizontal.png', x: 13, y: 14.4, w: 1, h: 1 }
    ],
    agents: [],
    notes: ['中介广告可以落在中介所门口', '角色去工作/吃饭/看房会先移动到对应分区', '房租压力会提高工厂和便利店权重']
  }
};

function Tile({ id }) {
  return <img className="pixel-world-tile" src={resolveImage(id)} alt="" draggable={false} />;
}

function LayerSprite({ item }) {
  return (
    <img
      className={`pixel-world-sprite ${item.wide ? 'wide' : ''}`}
      src={resolveImage(item.asset || item.tile)}
      alt=""
      draggable={false}
      style={{
        '--x': item.x,
        '--y': item.y,
        '--w': item.w || (item.wide ? 2 : 1),
        '--h': item.h || (item.tall ? 2 : 1)
      }}
    />
  );
}

function AgentSprite({ agent }) {
  return (
    <div
      className={`pixel-world-agent ${agent.path || ''}`}
      style={{
        '--x': agent.x,
        '--y': agent.y,
        '--hair': agent.look?.hair || '#6f4a8e',
        '--outfit': agent.look?.outfit || '#ff8fbd',
        '--accent': agent.look?.accent || '#ffd5e7'
      }}
      title={`${agent.name}: ${agent.status}`}
    >
      <div className="pixel-world-bubble">{agent.status}</div>
      {agent.look ? <Chibi /> : <img src={tile(agent.tile)} alt="" draggable={false} />}
      <span>{agent.name}</span>
    </div>
  );
}

function Chibi({ small = false, look }) {
  const style = look ? {
    '--hair': look.hair,
    '--outfit': look.outfit,
    '--accent': look.accent
  } : undefined;
  return (
    <div className={`pixel-world-chibi ${small ? 'small' : ''}`} style={style} aria-hidden="true">
      <i className="hair" />
      <i className="face" />
      <i className="body" />
      <i className="legs" />
    </div>
  );
}

function Structure({ item }) {
  const style = {
    '--x': item.x,
    '--y': item.y,
    '--w': item.w,
    '--h': item.h,
    '--roof': item.roof,
    '--trim': item.trim
  };
  if (item.kind === 'rug') {
    return <div className="pixel-world-rug" style={style} />;
  }
  if (item.kind === 'zone') {
    return <div className="pixel-world-zone" style={style}><span>{item.name}</span></div>;
  }
  if (item.kind === 'roomFrame') {
    return <div className="pixel-world-room-frame" style={style}><span>{item.name}</span></div>;
  }
  if (item.kind === 'furniture') {
    return <div className={`pixel-world-furniture ${item.type}`} style={style}><span>{item.name}</span></div>;
  }
  return (
    <div className="pixel-world-building" style={style}>
      <div className="pixel-world-building-roof" />
      <div className="pixel-world-building-body">
        <div className="pixel-world-window-row">
          <Tile id="0276" />
          <Tile id={item.sign || '0277'} />
          <Tile id="0276" />
        </div>
        <div className="pixel-world-door-row">
          <Tile id="0280" />
          <Tile id={item.door || '0283'} />
          <Tile id="0280" />
        </div>
      </div>
      <div className="pixel-world-building-name">{item.name}</div>
    </div>
  );
}

function Scene({ scene }) {
  const cells = useMemo(() => {
    const rows = scene.map || [];
    return rows.flatMap((row, y) => row.split('').map((code, x) => ({
      key: `${x}-${y}`,
      id: scene.palette[code] || scene.base
    })));
  }, [scene]);

  return (
    <div className="pixel-world-stage-wrap">
      <div
        className="pixel-world-stage"
        style={{ '--cols': scene.size.cols, '--rows': scene.size.rows }}
      >
        {scene.backdrop ? (
          <img className="pixel-world-backdrop" src={scene.backdrop} alt="" draggable={false} />
        ) : (
          <div className="pixel-world-grid">
            {cells.map((cell) => <Tile key={cell.key} id={cell.id} />)}
          </div>
        )}
        {!scene.backdrop && <div className="pixel-world-shadow-layer" />}
        {scene.structures.map((item) => <Structure key={`${item.name}-${item.x}-${item.y}`} item={item} />)}
        {scene.props.map((item) => <LayerSprite key={item.id} item={item} />)}
        {scene.agents.map((agent) => <AgentSprite key={agent.id} agent={agent} />)}
      </div>
    </div>
  );
}

function PixelWorldPanelContent({ apiUrl = '/api', userProfile = null }) {
  const [activeScene, setActiveScene] = useState('street');
  const [activeRoomStyle, setActiveRoomStyle] = useState('empty');
  const scene = activeScene === 'room' ? roomScenes[activeRoomStyle] : scenes.street;
  const roomStyleEntries = Object.entries(roomStyleMeta);

  return (
    <div className="pixel-world-page">
      <div className="pixel-world-header">
        <div>
          <div className="pixel-world-kicker">Pixel Implementation</div>
          <h2>像素实装模块</h2>
          <p>{scene.subtitle}</p>
        </div>
        <div className="pixel-world-tabs" role="tablist" aria-label="像素场景">
          <button className={activeScene === 'street' ? 'active' : ''} onClick={() => setActiveScene('street')}>商业街</button>
          <button className={activeScene === 'room' ? 'active' : ''} onClick={() => setActiveScene('room')}>居住房间</button>
        </div>
      </div>

      {activeScene === 'room' && roomStyleEntries.length > 1 && (
        <div className="pixel-world-style-tabs" role="tablist" aria-label="房间风格">
          {roomStyleEntries.map(([key, meta]) => (
            <button
              key={key}
              className={activeRoomStyle === key ? 'active' : ''}
              onClick={() => setActiveRoomStyle(key)}
            >
              {meta.label}
            </button>
          ))}
        </div>
      )}

      {activeScene === 'street' ? (
        <CommercialStreetEditor apiUrl={apiUrl} userProfile={userProfile} />
      ) : (
        <RoomAssetEditor scene={scene} apiUrl={apiUrl} userProfile={userProfile} />
      )}
    </div>
  );
}

class PixelWorldErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[PixelWorld] module crashed', error, info);
  }

  retry = () => {
    this.setState({ error: null });
  };

  clearPixelWorldCache = () => {
    [
      commercialV2StorageKey,
      commercialV2CanvasStorageKey,
      commercialV2ResetBackupStorageKey,
      commercialV2DefaultSnapshotStorageKey,
      commercialV2BehaviorConfigStorageKey,
      roomEditorPlayerStorageKey
    ].forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="pixel-world-page">
        <div className="pixel-world-crash-card">
          <div className="pixel-world-kicker">Pixel Implementation</div>
          <h2>像素实装模块没有正常打开</h2>
          <p>模块入口已经拦截住这次崩溃了。可以先重试；如果还是打不开，清理商业街本地布局缓存后会恢复默认布局。</p>
          <div className="pixel-world-crash-actions">
            <button onClick={this.retry}>重试打开</button>
            <button onClick={this.clearPixelWorldCache}>清理布局缓存</button>
          </div>
          <pre>{String(this.state.error?.message || this.state.error || 'Unknown error')}</pre>
        </div>
      </div>
    );
  }
}

export default function PixelWorldPanel(props) {
  return (
    <PixelWorldErrorBoundary>
      <PixelWorldPanelContent {...props} />
    </PixelWorldErrorBoundary>
  );
}

