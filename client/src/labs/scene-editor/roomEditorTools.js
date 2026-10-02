import { createRoomBehaviorDiagnostics } from './actions/createRoomBehaviorDiagnostics.js';
import { RoomEditorToolbar } from './components/RoomEditorToolbar.jsx';
import { RoomSelectionInspector } from './components/RoomSelectionInspector.jsx';
import { RoomBehaviorPanel } from './components/RoomBehaviorPanel.jsx';
import { RoomBehaviorContext } from './components/RoomBehaviorContext.jsx';
import { RoomAssetPanel } from './components/RoomAssetPanel.jsx';
import { createRoomLayoutActions } from './actions/createRoomLayoutActions.js';
export const roomEditorTools = {
    RoomEditorToolbar,
    RoomSelectionInspector,
    RoomBehaviorPanel,
    RoomBehaviorContext,
    RoomAssetPanel,
    createBehaviorDiagnostics: createRoomBehaviorDiagnostics,
    createLayoutActions: createRoomLayoutActions,
};
