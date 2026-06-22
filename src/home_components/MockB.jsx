import { SearchBar } from './SearchBar'
import logo from '/src/assets/header_logo.png'
import plant from '/src/assets/ghibliPlant.png'
import artImg from '/src/assets/art.png'
import beakerImg from '/src/assets/beaker.png'
import soccerImg from '/src/assets/soccer.png'
import guitarImg from '/src/assets/guitar.png'
import codeImg from '/src/assets/code.png'
import booksImg from '/src/assets/books.png'
import './MockB.css'

const CATEGORIES = [
  { label: 'Arts', img: artImg },
  { label: 'Science', img: beakerImg },
  { label: 'Sports', img: soccerImg },
  { label: 'Music', img: guitarImg },
  { label: 'Tech', img: codeImg },
  { label: 'Academic', img: booksImg },
]

export default function MockB() {
  return (
    <div className="mock-b">
      <nav className="mock-b-nav">
        <img src={logo} alt="Backyard" />
        <div />
      </nav>

      <section className="mock-b-hero">
        <div className="mock-b-left">
          <h1 className="mock-b-headline">
            Your<br />Backyard
          </h1>
          <p className="mock-b-sub">
            Where campus communities come alive. Find clubs, make friends,
            and discover everything your university has to offer.
          </p>
          <div className="mock-b-search">
            <SearchBar />
          </div>
          <div className="mock-b-btns">
            <button className="mock-b-btn mock-b-btn--outline">About Us</button>
            <button className="mock-b-btn mock-b-btn--fill">Browse Clubs</button>
          </div>
        </div>

        <div className="mock-b-right">
          <img src={plant} alt="" className="mock-b-illustration" />
        </div>
      </section>

      <section className="mock-b-categories">
        <h2 className="mock-b-cat-title">What's on the Board?</h2>
        <div className="mock-b-cat-row">
          {CATEGORIES.map((c) => (
            <div key={c.label} className="mock-b-cat-card">
              <img src={c.img} alt={c.label} />
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
