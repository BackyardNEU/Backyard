import { SearchBar } from './SearchBar'
import logo from '/src/assets/header_logo.png'
import artImg from '/src/assets/art.png'
import beakerImg from '/src/assets/beaker.png'
import soccerImg from '/src/assets/soccer.png'
import guitarImg from '/src/assets/guitar.png'
import codeImg from '/src/assets/code.png'
import booksImg from '/src/assets/books.png'
import './MockC.css'

const CATEGORIES = [
  { label: 'Arts', img: artImg },
  { label: 'Science', img: beakerImg },
  { label: 'Sports', img: soccerImg },
  { label: 'Music', img: guitarImg },
  { label: 'Tech', img: codeImg },
  { label: 'Academic', img: booksImg },
]

export default function MockC() {
  return (
    <div className="mock-c">
      <header className="mock-c-header">
        <img src={logo} alt="Backyard" />
      </header>

      <section className="mock-c-hero">
        <h1 className="mock-c-title">
          Your<br />Backyard
        </h1>
        <p className="mock-c-tagline">find your club. find your crew.</p>
        <div className="mock-c-search">
          <SearchBar />
        </div>
        <div className="mock-c-btns">
          <button className="mock-c-btn mock-c-btn--outline">About Us</button>
          <button className="mock-c-btn mock-c-btn--fill">Get Started</button>
        </div>
      </section>

      <hr className="mock-c-divider" />

      <section className="mock-c-categories">
        <div className="mock-c-cat-row">
          {CATEGORIES.map((c) => (
            <div key={c.label} className="mock-c-cat-item">
              <img src={c.img} alt={c.label} />
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      </section>

      <hr className="mock-c-divider" />

      <section className="mock-c-about">
        <img src="/raccoon_pfp.png" alt="Backyard mascot" className="mock-c-raccoon" />
        <div className="mock-c-about-text">
          <p>
            Built by students, for students. Backyard helps you discover every
            club and community at your school &mdash; so you never miss out on
            the things that make college worth it.
          </p>
          <button>Learn More</button>
        </div>
      </section>
    </div>
  )
}
