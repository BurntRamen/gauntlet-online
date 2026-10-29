import PlayerMenus from './PlayerMenus';
import { PlayerLayoutProvider } from './PlayerLayoutStudio';

// Keep menu customization out of the live-game/Admin bootstrap. App owns the
// existing gameplay callbacks; this boundary owns only player presentation.
export default function PlayerMenuExperience({ authToken, serverUrl, factionIds, ...menuProps }) {
  return <PlayerLayoutProvider account={menuProps.account} authToken={authToken} serverUrl={serverUrl} factionIds={factionIds}>
    <PlayerMenus {...menuProps} />
  </PlayerLayoutProvider>;
}
