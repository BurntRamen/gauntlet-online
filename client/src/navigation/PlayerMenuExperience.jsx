import PlayerMenus from './PlayerMenus';
import { PlayerLayoutProvider, StaticLayoutProvider } from './PlayerLayoutStudio';
import { MENU_LAYOUT_CUSTOMIZATION_ENABLED } from './menuFeatures';

// Keep menu customization out of the live-game/Admin bootstrap. App owns the
// existing gameplay callbacks; this boundary owns only player presentation.
export default function PlayerMenuExperience({ authToken, serverUrl, factionIds, ...menuProps }) {
  const Provider = MENU_LAYOUT_CUSTOMIZATION_ENABLED ? PlayerLayoutProvider : StaticLayoutProvider;
  return <Provider account={menuProps.account} authToken={authToken} serverUrl={serverUrl} factionIds={factionIds}>
    <PlayerMenus {...menuProps} />
  </Provider>;
}
