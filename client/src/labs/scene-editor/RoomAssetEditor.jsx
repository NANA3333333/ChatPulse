import Scene from '../../features/city/scene/RoomScene.jsx';
import { roomEditorTools } from './roomEditorTools.js';
export default function RoomAssetEditor(props) {
    return <Scene {...props} editorTools={roomEditorTools} />;
}
