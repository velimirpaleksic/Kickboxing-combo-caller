import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import ComboDisplay from './ComboDisplay.jsx';
import { techniqueCategories, techniqueList } from '../data/techniques.js';
import { getComboNotation } from '../utils/comboGenerator.js';

export default function CustomCombos({
  combos,
  useCustomCombos,
  onToggleCustom,
  onChange,
  onBack,
}) {
  const [activeCategory, setActiveCategory] = useState('punch');
  const [draftSteps, setDraftSteps] = useState([]);
  const [note, setNote] = useState('');

  const visibleTechniques = useMemo(
    () => techniqueList.filter((technique) => technique.category === activeCategory),
    [activeCategory]
  );

  const addTechnique = (technique) => {
    if (draftSteps.length >= 6) return;
    setDraftSteps((current) => [...current, technique]);
  };

  const removeStep = (index) => {
    setDraftSteps((current) => current.filter((_, stepIndex) => stepIndex !== index));
  };

  const moveStep = (index, direction) => {
    setDraftSteps((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  };

  const saveCombo = () => {
    if (draftSteps.length === 0) return;
    onChange([
      ...combos,
      {
        id: crypto.randomUUID(),
        note: note.trim(),
        steps: draftSteps,
      },
    ]);
    setDraftSteps([]);
    setNote('');
  };

  const deleteCombo = (id) => {
    onChange(combos.filter((combo) => combo.id !== id));
  };

  const draftCombo = {
    steps: draftSteps,
    notation: getComboNotation(draftSteps),
  };

  return (
    <section className="screen-stack">
      <header className="screen-header">
        <button className="icon-button" onClick={onBack} aria-label="Nazad">
          <ArrowLeft aria-hidden="true" />
        </button>
        <div>
          <p className="eyebrow">Kombinacije</p>
          <h1 className="screen-title">Moje kombinacije</h1>
        </div>
      </header>

      <div className="toggle-row">
        <div className="min-w-0">
          <h2 className="field-label">Moje kombinacije</h2>
          <p className="setting-description">
            {useCustomCombos ? 'Povremeno se ubacuju u trening.' : 'Trening koristi generator.'}
          </p>
        </div>
        <button
          className={useCustomCombos ? 'toggle-button-on' : 'toggle-button'}
          onClick={() => onToggleCustom(!useCustomCombos)}
          aria-pressed={useCustomCombos}
        >
          {useCustomCombos ? 'Uključeno' : 'Isključeno'}
        </button>
      </div>

      <div className="setting-group">
        <h2 className="field-label">Izaberi tehniku</h2>
        <div className="choice-grid">
          {techniqueCategories.map((category) => (
            <button
              key={category.id}
              className={activeCategory === category.id ? 'choice-button-active' : 'choice-button'}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <div className="technique-pick-list">
        {visibleTechniques.map((technique) => (
          <button
            key={technique.id}
            className="technique-pick-button"
            onClick={() => addTechnique(technique)}
            disabled={draftSteps.length >= 6}
          >
            <span className="technique-notation">{technique.notation}</span>
            <span className="technique-pick-label">{technique.label}</span>
            <Plus className="ml-auto shrink-0" aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="setting-group section-divider">
        <div className="split-row">
          <div>
            <h2 className="field-label">Nova kombinacija</h2>
            <p className="setting-description">Najviše 6 koraka.</p>
          </div>
          <button className="primary-button min-h-12 w-auto px-4" onClick={saveCombo}>
            Sačuvaj
          </button>
        </div>

        <label className="block">
          <span className="field-label">Napomena</span>
          <input
            className="text-field"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Npr. Rad na kontri"
          />
        </label>

        <ComboDisplay combo={draftCombo} placeholder="Dodaj tehniku" />

        <div className="draft-list">
          {draftSteps.map((step, index) => (
            <div className="draft-step-row" key={`${step.id}-${index}`}>
              <span className="draft-number">{index + 1}.</span>
              <span className="draft-label">{step.label}</span>
              <button className="mini-icon-button" onClick={() => moveStep(index, -1)} aria-label="Gore">
                <ArrowUp aria-hidden="true" />
              </button>
              <button className="mini-icon-button" onClick={() => moveStep(index, 1)} aria-label="Dole">
                <ArrowDown aria-hidden="true" />
              </button>
              <button className="mini-icon-button danger-mini" onClick={() => removeStep(index)} aria-label="Obriši">
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="setting-group">
        <h2 className="field-label">Sačuvano</h2>
        {combos.length === 0 && (
          <div className="empty-panel">Nema sačuvanih kombinacija.</div>
        )}

        <div className="saved-combo-list">
          {combos.map((combo) => (
            <article key={combo.id} className="saved-combo-row">
              {combo.note && <p className="saved-note">{combo.note}</p>}
              <ComboDisplay combo={{ ...combo, notation: getComboNotation(combo.steps) }} />
              <button className="danger-button mt-3" onClick={() => deleteCombo(combo.id)}>
                <Trash2 aria-hidden="true" />
                Obriši
              </button>
            </article>
          ))}
        </div>
      </div>

      <button className="secondary-button mt-auto min-h-14" onClick={onBack}>
        <ArrowLeft aria-hidden="true" />
        Nazad
      </button>
    </section>
  );
}
