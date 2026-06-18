import { Dumbbell, ListPlus, Mic, Settings as SettingsIcon } from 'lucide-react';

export default function Home({ onStart, onSettings, onCustomCombos, onAudioSetup }) {
  return (
    <section className="home-screen">
      <div className="home-hero">
        <p className="home-kicker">Kickboxing combo caller</p>
        <h1 className="home-title">Kombinacije</h1>
        <p className="home-copy">
          Trening kombinacija za vreću: runda, prozivka, udari vreću, pa sljedeća kombinacija.
        </p>
      </div>

      <div className="home-actions">
        <button className="primary-button min-h-20 text-xl" onClick={onStart}>
          <Dumbbell aria-hidden="true" />
          Start trening
        </button>

        <div className="home-action-grid">
          <button className="secondary-button min-h-16" onClick={onSettings}>
            <SettingsIcon aria-hidden="true" />
            Podešavanja
          </button>
          <button className="secondary-button min-h-16" onClick={onCustomCombos}>
            <ListPlus aria-hidden="true" />
            Moje kombinacije
          </button>
          <button className="secondary-button min-h-16 sm:col-span-2" onClick={onAudioSetup}>
            <Mic aria-hidden="true" />
            Podešavanje glasa
          </button>
        </div>
      </div>
    </section>
  );
}
