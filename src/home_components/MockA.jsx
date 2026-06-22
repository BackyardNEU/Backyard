import { SearchBar } from './SearchBar'
import heroGif from '/src/assets/hero_students.gif'
import logo from '/src/assets/header_logo.png'
import artImg from '/src/assets/art.png'
import beakerImg from '/src/assets/beaker.png'
import soccerImg from '/src/assets/soccer.png'
import guitarImg from '/src/assets/guitar.png'
import codeImg from '/src/assets/code.png'
import booksImg from '/src/assets/books.png'
import './MockA.css'

const CATEGORIES = [
  { label: 'Arts', img: artImg },
  { label: 'Science', img: beakerImg },
  { label: 'Sports', img: soccerImg },
  { label: 'Music', img: guitarImg },
  { label: 'Tech', img: codeImg },
  { label: 'Academic', img: booksImg },
]

export default function MockA({ onOpenLogin }) {
  return (
    <div className="mock-a">
      <section className="mock-a-hero">
        <img src={heroGif} alt="" className="mock-a-bg" />
        <div className="mock-a-overlay" />

        <nav className="mock-a-nav">
          <img src={logo} alt="Backyard" className="mock-a-logo" />
          <a href="https://buymeacoffee.com" target="_blank" rel="noopener noreferrer" className="mock-a-coffee">
            <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" />
          </a>
        </nav>

        <div className="mock-a-content">
          <h1 className="mock-a-headline">Find Your People</h1>
          <p className="mock-a-sub">
            Discover clubs, communities &amp; friends at your university
          </p>
          <div className="mock-a-search">
            <SearchBar />
          </div>
          <div className="mock-a-btns">
            <button className="mock-a-btn mock-a-btn--outline" onClick={() => document.getElementById('mock-a-about').scrollIntoView({ behavior: 'smooth' })}>About Us</button>
            <button className="mock-a-btn mock-a-btn--fill" onClick={onOpenLogin}>Explore Clubs</button>
          </div>
        </div>

        <button
          className="mock-a-scroll-arrow"
          onClick={() => document.getElementById('mock-a-categories').scrollIntoView({ behavior: 'smooth' })}
          aria-label="Scroll down"
        >
          &#x2193;
        </button>
      </section>
      <section id="mock-a-categories" className="mock-a-categories">
        <h2 className="mock-a-cat-title">Browse by Category</h2>
        <div className="mock-a-cat-row">
          {CATEGORIES.map((c) => (
            <div key={c.label} className="mock-a-cat-item">
              <img src={c.img} alt={c.label} />
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="mock-a-about" className="mock-a-about">
        <div className="mock-a-about-inner">
          <h2 className="mock-a-about-title">About Us</h2>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
            tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
            quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>
          <p>
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore
            eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt
            in culpa qui officia deserunt mollit anim id est laborum.
          </p>
          <p>
            Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius,
            turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis
            sollicitudin mauris. Integer in mauris eu nibh euismod gravida.
          </p>
        </div>
      </section>
    </div>
  )
}
