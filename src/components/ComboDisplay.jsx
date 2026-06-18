import { getComboNotation } from '../utils/comboGenerator.js';
import ComboStepBox from './ComboStepBox.jsx';

export default function ComboDisplay({
  combo,
  placeholder = 'Spremi se',
  notationDisplay = 'Ispod kombinacije',
  animationKey = '',
}) {
  const steps = combo?.steps || [];
  const notation = combo?.notation || getComboNotation(steps);
  const visibleSteps = steps.length > 0 ? steps : [{ id: 'placeholder', label: placeholder }];
  const showInlineNotation = notation && notationDisplay === 'Ispod kombinacije' && steps.length > 0;

  return (
    <div className="combo-board" key={animationKey}>
      <div className="combo-list">
        {visibleSteps.map((step, index) => (
          <ComboStepBox
            key={`${step.id}-${index}`}
            number={steps.length > 0 ? index + 1 : ''}
            label={step.label}
            index={index}
          />
        ))}
      </div>

      {showInlineNotation && <p className="combo-notation">{notation}</p>}
    </div>
  );
}
