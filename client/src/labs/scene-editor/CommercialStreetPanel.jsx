import Panel from '../../features/city/scene/CommercialStreetPanel.jsx';
import { commercialEditorTools } from './commercialEditorTools.js';
export default function CommercialStreetPanel(props) {
    return <Panel {...props} editorTools={commercialEditorTools} />;
}
