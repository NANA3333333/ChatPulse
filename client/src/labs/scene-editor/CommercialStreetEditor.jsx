import Scene from '../../features/city/scene/CommercialStreetScene.jsx';
import { commercialEditorTools } from './commercialEditorTools.js';
export default function CommercialStreetEditor(props) {
    return <Scene {...props} editorTools={commercialEditorTools} />;
}
