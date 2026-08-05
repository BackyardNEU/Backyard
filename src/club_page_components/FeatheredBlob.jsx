import React from 'react';

/**
 * Feathered, morphing blob that masks an image into an organic shape.
 * Reusable extraction of the prototype in MagicBlobFeathered.jsx.
 *
 * The component fills its parent (width/height: 100%), so the PARENT is responsible
 * for sizing the stage to the blob's aspect (see ClubMediaModule's contain-fit). The
 * blob path is authored in a 200x200 space and scaled non-uniformly to the chosen
 * aspect; the <image> covers that frame with preserveAspectRatio="slice" so the photo
 * crops to fill instead of distorting.
 *
 * @param {string} image - image URL painted inside the blob.
 * @param {string} aspectRatio - e.g. '1 / 1', '16 / 9', '9 / 16'.
 * @param {string} color - glow/aura color behind the blob.
 * @param {number} feather - feGaussianBlur stdDeviation softening the rim.
 * @param {string} className - extra classes on the root (e.g. a float animation).
 */
function FeatheredBlob({ image, aspectRatio = '1 / 1', color = '#1e2630', feather = 6, className = '' }) {
  const uid = React.useId().replace(/:/g, '');
  const maskId = `blobMask-${uid}`;
  const blurId = `blobBlur-${uid}`;

  // Map the aspect onto a viewBox whose long side is 200, then scale the unit blob to fill it.
  const [aw, ah] = aspectRatio.split('/').map((s) => parseFloat(s));
  const vbW = aw >= ah ? 200 : (200 * aw) / ah;
  const vbH = ah >= aw ? 200 : (200 * ah) / aw;
  const sx = vbW / 200;
  const sy = vbH / 200;

  // Four distinct silhouettes (each M + 4C + Z) for an obvious SMIL morph.
  const p1 = 'M100,18 C150,20 182,52 182,100 C182,148 150,182 100,182 C50,182 18,148 18,100 C18,52 50,20 100,18 Z';
  const p2 = 'M100,6 C165,18 196,55 180,106 C166,150 128,178 98,182 C60,188 32,148 26,102 C20,56 42,16 100,6 Z';
  const p3 = 'M100,20 C138,8 172,46 184,90 C194,138 168,196 108,184 C58,174 10,166 16,104 C20,46 66,32 100,20 Z';
  const p4 = 'M100,16 C152,10 180,60 186,104 C192,150 146,180 100,188 C52,196 18,150 14,98 C10,46 50,22 100,16 Z';
  const morph = `${p1};${p2};${p3};${p4};${p1}`;

  return (
    <div className={`relative ${className}`} style={{ width: '100%', height: '100%' }}>
      {/* Soft aura behind the blob */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${color}55 0%, ${color}22 38%, transparent 72%)`,
          filter: 'blur(24px)',
        }}
      />

      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="relative w-full h-full overflow-visible">
        <defs>
          <filter id={blurId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={feather} />
          </filter>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="-80" y="-80" width="360" height="360">
            <g transform={`scale(${sx} ${sy})`}>
              <path fill="#fff" filter={`url(#${blurId})`} d={p1}>
                <animate
                  attributeName="d"
                  dur="7s"
                  repeatCount="indefinite"
                  calcMode="spline"
                  keyTimes="0;0.25;0.5;0.75;1"
                  keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"
                  values={morph}
                />
              </path>
            </g>
          </mask>
        </defs>

        <image
          href={image}
          x="0"
          y="0"
          width={vbW}
          height={vbH}
          preserveAspectRatio="xMidYMid slice"
          mask={`url(#${maskId})`}
        />
      </svg>

      {/* Specular highlight over the opaque core */}
      <div
        className="absolute top-[12%] left-[16%] w-[26%] h-[26%] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.04) 70%, transparent 100%)',
          filter: 'blur(8px)',
        }}
      />
    </div>
  );
}

export default React.memo(FeatheredBlob);
