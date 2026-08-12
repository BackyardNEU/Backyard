import React, { useEffect, useState } from 'react';
import borderImg from '/src/assets/border.svg';
import borderHorizontalImg from '/src/assets/border-horizontal.svg';
import './PolaroidCards.css';

const determineLayout = (ratio) => {
  if (ratio >= 1.05 && ratio <= 1.25) return 'full';
  if (ratio >= 0.7 && ratio <= 0.82) return 'polaroid';
  if (ratio >= 0.45 && ratio <= 0.6) return 'portrait';
  if (ratio > 1.25) return 'full';
  return 'polaroid';
};

export const PolaroidCards = ({ photos = [] }) => {
  const [cards, setCards] = useState([]);

  useEffect(() => {
    let cancelled = false;

    if (!photos || photos.length === 0) {
      setCards([]);
      return;
    }

    const loadCards = async () => {
      const loaded = await Promise.all(
        photos.map(
          (src) =>
            new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                const ratio = img.width / img.height;
                resolve({
                  id: src,
                  src,
                  ratio,
                  layout: determineLayout(ratio),
                  width: img.width,
                  height: img.height,
                });
              };
              img.onerror = () => resolve(null);
              img.src = src;
            })
        )
      );
      if (!cancelled) setCards(loaded.filter(Boolean));
    };

    loadCards();
    return () => {
      cancelled = true;
    };
  }, [photos]);

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="polaroid-container">
      <div className="card-grid">
        {cards.map((card) => {
          const r = card.ratio;
          let imageContent;

          if (r >= 0.9 && r <= 1.2) {
            imageContent = (
              <div className="square-layout">
                <img src={card.src} alt="profile" className="square-image" />
              </div>
            );
          } else if (r < 0.9) {
            imageContent = (
              <div className="portrait-layout">
                <div className="portrait-frame">
                  <img src={card.src} alt="profile" className="portrait-image" />
                </div>
              </div>
            );
          } else {
            imageContent = (
              <div className="landscape-layout">
                <div className="landscape-frame">
                  <div className="landscape-aspect">
                    <img src={card.src} alt="profile" className="landscape-image" />
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={card.id} className="polaroid-card">
              <img src={borderImg} alt="" className="polaroid-card-border polaroid-card-border-left" />
              <img src={borderImg} alt="" className="polaroid-card-border polaroid-card-border-right" />
              <div
                className="polaroid-card-border-h-wrap polaroid-card-border-top-wrap"
                style={{ backgroundImage: `url(${borderHorizontalImg})` }}
                aria-hidden="true"
              />
              <div
                className="polaroid-card-border-h-wrap polaroid-card-border-bottom-wrap"
                style={{ backgroundImage: `url(${borderHorizontalImg})` }}
                aria-hidden="true"
              />
              {imageContent}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PolaroidCards;
