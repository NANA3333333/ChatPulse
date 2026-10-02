
export function useSceneRenderer(dependencies) {
const { PrivateChatDecorEditor, getPrivateChatDecorStyle, hasForegroundSceneView, lang, privateChatDecorEditorOpen, privateChatDecorTransforms, setPrivateChatDecorEditorOpenPersisted, setPrivateChatDecorTransforms } = dependencies;
function renderPrivateChatForegroundScene({ includeEditor = false } = {}) {
    return (
      <>
        <div className="private-chat-floor-decor" aria-hidden="true">
          <div className="private-chat-stage-layer private-chat-floor-stage">
            <img
              className="private-chat-scene-decor__floor"
              data-private-decor-id="floor"
              style={getPrivateChatDecorStyle('floor')}
              src="/assets/ui/private-chat/pixel-foreground-floor-ai-grid.png?v=20260702-crop-top2"
              alt=""
            />
          </div>
        </div>
        <div className="private-chat-scene-decor" aria-hidden="true">
          <div className="private-chat-stage-layer private-chat-scene-stage">
            <img
              className="private-chat-scene-decor__left"
              data-private-decor-id="left"
              style={getPrivateChatDecorStyle('left')}
              src="/assets/ui/private-chat/pixel-foreground-left-cart.png?v=20260708-glass-light1"
              alt=""
            />
            <img
              className="private-chat-scene-decor__right"
              data-private-decor-id="right"
              style={getPrivateChatDecorStyle('right')}
              src="/assets/ui/private-chat/pixel-foreground-right-sign.png?v=20260702-recut1"
              alt=""
            />
          </div>
        </div>
        {includeEditor && (
          <PrivateChatDecorEditor
            open={privateChatDecorEditorOpen}
            onOpenChange={setPrivateChatDecorEditorOpenPersisted}
            transforms={privateChatDecorTransforms}
            setTransforms={setPrivateChatDecorTransforms}
            isPrivateChatView={hasForegroundSceneView}
            lang={lang}
          />
        )}
      </>
    );
  }
    return { renderPrivateChatForegroundScene };
}
