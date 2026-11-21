// Only registered destination tiles accept artwork overrides. Utility panels
// and campaign faction tiles keep their own content-owned presentation.
const sections = require('../websiteSections.json');
const icons = ['play','campaign','decks','draft','compete','matches','community','learn','profile','settings'];
function visualFields(page) {
  return [{ key: `${page}PageBackground`, element: 'background', part: 'background', type: 'asset' },
    ...(sections[page] || []).filter(id => !['active-deck','recent-matches'].includes(id)).flatMap(id => [
      {key:`${page}PageTile-${id}-Image`,element:id,part:'artwork',type:'asset'},
      {key:`${page}PageTile-${id}-Icon`,element:id,part:'icon',type:'choice'}
    ])];
}
module.exports = {icons,visualFields};
