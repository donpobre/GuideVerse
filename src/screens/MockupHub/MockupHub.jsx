import { Link } from 'react-router-dom'
import { screenRegistry } from '../../data/mockData'
import './MockupHub.css'

export default function MockupHub() {
  return (
    <main className="mockup-hub portal-page container">
      <header className="portal-header">
        <div>
          <h1>GuideVerse Screen Mockups</h1>
          <p>All 33 screens across 5 portals — per GuideVerse_Screen_Specifications.md</p>
        </div>
        <Link to="/" className="btn btn-primary">View Homepage</Link>
      </header>
      {screenRegistry.map(portal => (
        <section key={portal.portal} className="mockup-portal">
          <h2>{portal.portal} Portal</h2>
          <div className="mockup-screen-list">
            {portal.screens.map(s => (
              <Link key={s.id} to={s.path} className="mockup-screen-link">
                <span>{s.name}</span>
                <span className="id">{s.id}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
