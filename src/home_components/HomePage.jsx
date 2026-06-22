import { useState } from 'react'
import MockA from './MockA'
import MockB from './MockB'
import MockC from './MockC'

const MOCKS = [
  { key: 'A', label: 'A — Video Hero', component: MockA },
  { key: 'B', label: 'B — Split Layout', component: MockB },
  { key: 'C', label: 'C — Bold Stacked', component: MockC },
]

export default function HomePage({ onOpenLogin }) {
  const [active, setActive] = useState('A')
  const ActiveMock = MOCKS.find(m => m.key === active).component

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9000,
        display: 'flex',
        gap: 8,
        background: 'rgba(0,0,0,0.8)',
        padding: '8px 16px',
        borderRadius: 40,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}>
        {MOCKS.map(m => (
          <button
            key={m.key}
            onClick={() => setActive(m.key)}
            style={{
              fontFamily: '"Barlow Condensed", sans-serif',
              fontSize: '0.85rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              padding: '6px 16px',
              border: 'none',
              borderRadius: 20,
              cursor: 'pointer',
              background: active === m.key ? 'rgb(46,120,139)' : 'transparent',
              color: '#fff',
              transition: 'background 0.2s ease',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <ActiveMock onOpenLogin={onOpenLogin} />
    </div>
  )
}
