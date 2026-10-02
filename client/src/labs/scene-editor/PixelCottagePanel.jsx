import Panel from '../../features/city/scene/PixelCottagePanel.jsx';
import { roomEditorTools } from './roomEditorTools.js';
export default function PixelCottagePanel(props) {
    return <Panel {...props} editorTools={roomEditorTools} />;
}
