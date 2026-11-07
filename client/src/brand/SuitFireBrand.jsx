import { useBrandPreview } from './brandPreview';
import { GAUNTLET_CREST } from '../navigation/menuArtwork';
import React from 'react';
import { resolveVisualAsset } from '../GauntletVisuals';
import { BRAND_ASSETS, BRAND_SETS, activeBrandSet } from './brandArtwork';
import './SuitFireBrand.css';
export default function SuitFireBrand({ full = false, backdrop = true, setId = activeBrandSet }) {
 const preview = useBrandPreview();
 if (!preview) return <span className={'gauntlet-brand ' + (full ? 'is-full' : 'is-compact')}>
  <img className="gauntlet-brand-mark" src={resolveVisualAsset(GAUNTLET_CREST)} alt="Gauntlet Online" />
  {!full && <span className="gauntlet-brand-name" aria-hidden="true">Gauntlet<small>Online</small></span>}
 </span>;
 const set = BRAND_SETS[setId] || BRAND_SETS[activeBrandSet];
 return <span className={'suitfire-brand ' + (full ? 'is-full' : 'is-compact')} data-brand-set={setId}>
  {backdrop && <span className="suitfire-brand-art" aria-hidden="true">{set.artwork.map(src => <img key={src} src={resolveVisualAsset(src)} alt="" />)}</span>}
  <img className="suitfire-brand-mark" src={resolveVisualAsset(full ? BRAND_ASSETS.full : BRAND_ASSETS.crest)} alt="SuitFire" />
  {!full && <span className="suitfire-brand-name" aria-hidden="true">SuitFire</span>}
 </span>;
}
