import React, { useRef, useState } from 'react'

import './style.css'




export default function MagicBlobFeathered() {
  const [glowColor, setGlowColor] = React.useState('#1e2630');
  const [blobImage, setBlobImage] = React.useState(
    'https://images.unsplash.com/photo-1511300636408-a63a89df3482?q=80&w=1200&auto=format&fit=crop'
  );
  const [aspectRatio, setAspectRatio] = React.useState('1 / 1');
  const [feather, setFeather] = React.useState(6); // feGaussianBlur stdDeviation

  const aspectMap = {
    '1 / 1': 'w-[18rem] h-[18rem]',
    '4 / 3': 'w-[20rem] h-[15rem]',
    '3 / 4': 'w-[15rem] h-[20rem]',
    '16 / 9': 'w-[22rem] h-[12.4rem]',
    '9 / 16': 'w-[12.4rem] h-[22rem]',
    '3 / 2': 'w-[21rem] h-[14rem]',
    '2 / 3': 'w-[14rem] h-[21rem]',
  };
  const blobSize = aspectMap[aspectRatio] || aspectMap['1 / 1'];

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden bg-[#050505] p-10">
      {/* Ambient background */}
      <div
        className="absolute w-[34rem] h-[34rem] rounded-full"
        style={{
          background: `radial-gradient(circle at top, ${glowColor}, transparent 72%)`,
          filter: 'blur(160px)',
          opacity: 0.12,
        }}
      />

      {/* Poster */}
      <div
        className="relative w-[420px] h-[620px] rounded-[38px] overflow-hidden border border-white/10 shadow-2xl"
        style={{ background: glowColor }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom right, rgba(255,255,255,0.05), transparent 35%, rgba(0,0,0,0.12))',
          }}
        />

        {/* Blob section */}
        <div className="relative flex items-center justify-center w-full h-full overflow-hidden">
          {/* Portal aura */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="absolute rounded-full"
              style={{
                width: '26rem',
                height: '26rem',
                background: `radial-gradient(circle, ${glowColor}55 0%, ${glowColor}22 35%, transparent 72%)`,
                filter: 'blur(50px)',
                opacity: 0.9,
              }}
            />
            <div
              className="absolute rounded-full border border-white/10"
              style={{
                width: '22rem',
                height: '22rem',
                background: `radial-gradient(circle, transparent 48%, ${glowColor}44 72%, transparent 100%)`,
                filter: 'blur(16px)',
                opacity: 0.7,
              }}
            />
          </div>

          <FeatheredBlob
            image={blobImage}
            feather={feather}
            blobSize={blobSize}
            aspectRatio={aspectRatio}
          />
        </div>

        {/* Controls */}
        <div className="absolute bottom-0 left-0 w-full p-7">
          <div className="space-y-4">
            <div>
              <p className="text-white text-2xl font-semibold tracking-tight">
                Magic Blob
              </p>
              <p className="text-white/45 text-sm mt-1">Interactive poster concept</p>
            </div>

            <div className="flex gap-3 items-center flex-wrap">
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="px-4 py-3 rounded-2xl border border-white/10 bg-white/[0.04] text-white/80 text-sm outline-none"
              >
                <option value="1 / 1">1:1</option>
                <option value="4 / 3">4:3</option>
                <option value="3 / 4">3:4</option>
                <option value="16 / 9">16:9</option>
                <option value="9 / 16">9:16</option>
                <option value="3 / 2">3:2</option>
                <option value="2 / 3">2:3</option>
              </select>

              <input
                type="color"
                value={glowColor}
                onChange={(e) => setGlowColor(e.target.value)}
                className="w-12 h-12 rounded-xl overflow-hidden bg-transparent border border-white/10 cursor-pointer"
              />

              <label className="px-4 py-3 rounded-2xl border border-white/10 bg-white/[0.04] text-white/80 text-sm cursor-pointer hover:bg-white/[0.08] transition">
                Upload Image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setBlobImage(URL.createObjectURL(file));
                  }}
                />
              </label>
            </div>

            <label className="flex items-center gap-3 text-white/60 text-xs">
              <span className="w-14">Feather</span>
              <input
                type="range"
                min="0"
                max="24"
                step="0.5"
                value={feather}
                onChange={(e) => setFeather(Number(e.target.value))}
                className="flex-1 accent-white/80"
              />
              <span className="tabular-nums text-white/40 w-8">{feather}</span>
            </label>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-12px); }
        }
        .animate-float { animation: float 7s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/**
 * Feathered blob.
 *
 * Shape + aspect: the blob path is authored in a 200x200 space, then the whole
 * group is scaled NON-uniformly (sx, sy) to the chosen aspect. Changing the
 * aspect therefore restretches the silhouette. The <image> covers that same
 * aspect frame with preserveAspectRatio="slice", so the PHOTO crops to fill
 * instead of distorting.
 *
 * Feather: the mask is the blob path filled white and blurred. Blurring a solid
 * shape leaves the interior fully opaque and only softens the rim — so the
 * feather lives in the cutout edge itself and rides the morph. Keep `feather`
 * modest so the lobes stay defined as they animate.
 */
function FeatheredBlob({ image, feather, blobSize, aspectRatio }) {
  const uid = React.useId().replace(/:/g, '');
  const maskId = `blobMask-${uid}`;
  const blurId = `blobBlur-${uid}`;

  // Map the aspect onto a viewBox whose long side is 200, then scale the unit
  // blob to fill it.
  const [aw, ah] = aspectRatio.split('/').map((s) => parseFloat(s));
  const vbW = aw >= ah ? 200 : (200 * aw) / ah;
  const vbH = ah >= aw ? 200 : (200 * ah) / aw;
  const sx = vbW / 200;
  const sy = vbH / 200;

  // Four clearly distinct blobs (each M + 4C + Z) so the SMIL morph is obvious.
  const p1 = 'M100,18 C150,20 182,52 182,100 C182,148 150,182 100,182 C50,182 18,148 18,100 C18,52 50,20 100,18 Z';
  const p2 = 'M100,6 C165,18 196,55 180,106 C166,150 128,178 98,182 C60,188 32,148 26,102 C20,56 42,16 100,6 Z';
  const p3 = 'M100,20 C138,8 172,46 184,90 C194,138 168,196 108,184 C58,174 10,166 16,104 C20,46 66,32 100,20 Z';
  const p4 = 'M100,16 C152,10 180,60 186,104 C192,150 146,180 100,188 C52,196 18,150 14,98 C10,46 50,22 100,16 Z';
  const morph = `${p1};${p2};${p3};${p4};${p1}`;

  return (
    <div className={`relative animate-float ${blobSize}`}>
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        className="w-full h-full overflow-visible"
      >
        <defs>
          <filter id={blurId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={feather} />
          </filter>
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x="-80"
            y="-80"
            width="360"
            height="360"
          >
            <g transform={`scale(${sx} ${sy})`}>
              <path fill="#fff" filter={`url(#${blurId})`} d={p1}>
                <animate
                  attributeName="d"
                  dur="8s"
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

      {/* specular highlight over the opaque core */}
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