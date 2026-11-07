import React, { useId } from 'react';
import { chooseBrand, useBrandState } from './brandPreview';

export default function BrandChoice() {
  const { eligible, active } = useBrandState();
  const name = useId();
  if (!eligible) return null;
  return <fieldset className="brand-choice cd-notice">
    <legend>Game appearance</legend>
    <p>Choose the branding you see. Saved for your account in this browser.</p>
    <div className="brand-choice-options">
      <label><input type="radio" name={name} checked={!active} onChange={() => chooseBrand('gauntlet')} />Gauntlet Online</label>
      <label><input type="radio" name={name} checked={active} onChange={() => chooseBrand('suitfire')} />SuitFire preview</label>
    </div>
  </fieldset>;
}
