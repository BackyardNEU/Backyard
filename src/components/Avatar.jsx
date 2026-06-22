import './Avatar.css';

const COLORS = ['#F44336', '#9C27B0', '#2196F3', '#009688', '#FF9800', '#795548', '#607D8B', '#E91E63'];

function hashString(str) {
  let hash = 0;
  for (const ch of str) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return Math.abs(hash);
}

function getInitials(firstName, lastName) {
  const first = (firstName || '')[0] || '';
  const last = (lastName || '')[0] || '';
  return (first + last).toUpperCase() || '?';
}

export default function Avatar({ url, firstName, lastName, size = 80, className = '' }) {
  const initials = getInitials(firstName, lastName);
  const color = COLORS[hashString(`${firstName}${lastName}`) % COLORS.length];

  if (url) {
    return <img src={url} alt="Profile" className={`avatar ${className}`} style={{ width: size, height: size }} />;
  }

  return (
    <div
      className={`avatar avatar-initials ${className}`}
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}
