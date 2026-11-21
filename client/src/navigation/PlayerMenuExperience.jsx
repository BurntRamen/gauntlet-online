import PlayerMenus from './PlayerMenus';
import { PlayerLayoutProvider, StaticLayoutProvider } from './PlayerLayoutStudio';

// Keep menu customization out of the live-game/Admin bootstrap. App owns the
// existing gameplay callbacks; this boundary owns only player presentation.
export default function PlayerMenuExperience({ authToken, serverUrl, factionIds, ...menuProps }) {
  const Provider = process.env.REACT_APP_MENU_LAYOUT_CUSTOMIZATION === "true" ? PlayerLayoutProvider : StaticLayoutProvider;
  return <Provider account={menuProps.account} authToken={authToken} serverUrl={serverUrl} factionIds={factionIds}>
    <PlayerMenus {...menuProps} serverUrl={serverUrl} />
  </Provider>;
}
