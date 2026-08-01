import borderGrayImg from '/src/assets/border-gray-dark.svg';
import borderHorizontalGrayImg from '/src/assets/border-horizontal-gray-dark.svg';
import borderBlackImg from '/src/assets/border.svg';
import borderHorizontalBlackImg from '/src/assets/border-horizontal.svg';

/**
 * Text input wrapped in the same ink-line SVG border used by cm-poster / comment-card / login-card.
 * Darker gray by default; a black variant fades in on focus (same shape/positioning, different asset).
 */
function BorderedInput({ wrapClassName = '', className = '', ...inputProps }) {
  return (
    <div className={`bordered-input-wrap ${wrapClassName}`}>
      <input className={`bordered-input ${className}`} {...inputProps} />

      <img src={borderGrayImg} alt="" className="bordered-input-border bordered-input-border-left bordered-input-border--gray" />
      <img src={borderGrayImg} alt="" className="bordered-input-border bordered-input-border-right bordered-input-border--gray" />
      <div
        className="bordered-input-border-h-wrap bordered-input-border-top-wrap bordered-input-border--gray"
        style={{ backgroundImage: `url(${borderHorizontalGrayImg})` }}
        aria-hidden="true"
      />
      <div
        className="bordered-input-border-h-wrap bordered-input-border-bottom-wrap bordered-input-border--gray"
        style={{ backgroundImage: `url(${borderHorizontalGrayImg})` }}
        aria-hidden="true"
      />

      <img src={borderBlackImg} alt="" className="bordered-input-border bordered-input-border-left bordered-input-border--active" />
      <img src={borderBlackImg} alt="" className="bordered-input-border bordered-input-border-right bordered-input-border--active" />
      <div
        className="bordered-input-border-h-wrap bordered-input-border-top-wrap bordered-input-border--active"
        style={{ backgroundImage: `url(${borderHorizontalBlackImg})` }}
        aria-hidden="true"
      />
      <div
        className="bordered-input-border-h-wrap bordered-input-border-bottom-wrap bordered-input-border--active"
        style={{ backgroundImage: `url(${borderHorizontalBlackImg})` }}
        aria-hidden="true"
      />
    </div>
  );
}

export default BorderedInput;
