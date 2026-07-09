import React from 'react';

const LIVE2D_WALLPAPER_URL = '/assets/ui/desktop/live2d-wallpaper-reference-alt.png?v=ocean-alt-1';

function WallpaperImage({ className = '', src = LIVE2D_WALLPAPER_URL, children, ...props }) {
  return (
    <image
      className={className}
      href={src}
      x="0"
      y="0"
      width="1672"
      height="941"
      preserveAspectRatio="xMidYMid slice"
      {...props}
    >
      {children}
    </image>
  );
}

function Live2DDesktopWallpaper({ animated = true, src = LIVE2D_WALLPAPER_URL }) {
  const imageProps = animated
    ? { x: '-118', y: '-82', width: '1908', height: '1105' }
    : {};

  return (
    <div
      className="desktop-live2d-wallpaper"
      style={{ '--desktop-live2d-wallpaper-image': `url("${src}")` }}
      aria-hidden="true"
    >
      <div className="desktop-live2d-wallpaper__stage">
        <svg className="desktop-live2d-wallpaper__svg" viewBox="0 0 1672 941" preserveAspectRatio="xMidYMid slice">
          <WallpaperImage className="desktop-live2d-wallpaper__flow" src={src} {...imageProps}>
            {animated && (
              <animateTransform
                attributeName="transform"
                type="translate"
                dur="10.5s"
                values="-72 -48;76 50;76 50;-72 -48;-72 -48"
                keyTimes="0;0.46;0.57;0.88;1"
                calcMode="spline"
                keySplines="0.36 0 0.22 1;0.4 0 0.6 1;0.45 0 0.3 1;0.4 0 0.6 1"
                repeatCount="indefinite"
              />
            )}
          </WallpaperImage>
        </svg>
      </div>
    </div>
  );
}

export default Live2DDesktopWallpaper;
