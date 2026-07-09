import * as React from 'react';
import './styles.css';

export default class App extends React.Component {
  componentDidMount() {
    import('./main.js');
  }

  render() {
    return (
      <>
        <canvas id="game-canvas" aria-label="Kumes Istilasi oyun alani" />

        <main className="shell">
          <section className="hud" aria-label="Oyun durumu">
            <div className="metric">
              <span>Skor</span>
              <strong id="score">0</strong>
            </div>
            <div className="metric">
              <span>Bolum</span>
              <strong id="wave">1</strong>
            </div>
            <div className="metric">
              <span>Can</span>
              <strong id="lives">3</strong>
            </div>
            <div className="metric">
              <span>Guc</span>
              <strong id="power">1</strong>
            </div>
            <button id="pause-button" className="icon-button" type="button" aria-label="Duraklat">
              II
            </button>
          </section>

          <section id="stage-banner" className="stage-banner" aria-live="polite" />

          <section id="overlay" className="overlay is-visible">
            <div className="panel">
              <p className="eyebrow">Classic Arcade</p>
              <h1>Kumes Istilasi</h1>
              <button id="start-button" className="primary-button" type="button">
                Oyna
              </button>
            </div>
          </section>
        </main>
      </>
    );
  }
}
