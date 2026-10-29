import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LayoutGrid, PageLayoutSettings, PlayerLayoutProvider, usePlayerLayout } from './PlayerLayoutStudio';
import { clearGuestSessionFallback, emptyLayoutPreferences, GUEST_LAYOUT_STORAGE_KEY, moveLayoutModule } from './layoutPreferences';

const startGame = jest.fn();
const items = [
  { id: 'basic-ai', label: 'Basic vs AI', content: <button onClick={startGame}>Start Basic match</button> },
  { id: 'ranked', label: 'Ranked', content: <button>Open Ranked setup</button> },
  { id: 'draft', label: 'Draft', content: <button>Open Draft setup</button> },
];
const envelope = (preferences = emptyLayoutPreferences(), revision = 0) => ({ preferences, revision });
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

function TestPage() {
  const layout = usePlayerLayout();
  return <><button onClick={() => layout.setEditing(true)}>Customize this page</button><LayoutGrid pageId="play" items={items} /><PageLayoutSettings /></>;
}
function App(props) { return <PlayerLayoutProvider {...props}><TestPage /></PlayerLayoutProvider>; }
const moduleOrder = () => [...document.querySelectorAll('[data-layout-module]')].map((node) => node.dataset.layoutModule);

beforeEach(() => { localStorage.clear(); clearGuestSessionFallback(); startGame.mockClear(); global.fetch = jest.fn(); });
afterEach(() => { jest.restoreAllMocks(); });

test('editing is opt-in, disables actions and supports keyboard dropdown movement, hiding and restoring', async () => {
  render(<App />);
  expect(screen.queryByLabelText('Panel options for Basic vs AI')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start Basic match' }));
  expect(startGame).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Customize this page' }));
  expect(screen.getByRole('switch', { name: 'Customize Mode' })).toBeChecked();
  fireEvent.click(screen.getByText('Start Basic match'));
  expect(startGame).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Start Basic match').closest('[inert]')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Panel options for Ranked'), { target: { value: 'first' } });
  expect(moduleOrder()).toEqual(['ranked', 'basic-ai', 'draft']);
  await waitFor(() => expect(screen.getByLabelText('Panel options for Ranked')).toHaveFocus());
  fireEvent.change(screen.getByLabelText('Panel options for Basic vs AI'), { target: { value: 'hide' } });
  expect(screen.getByText('Hidden in normal view')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'Done Editing' })[0]);
  expect(screen.queryByText('Start Basic match')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Customize this page' }));
  fireEvent.click(screen.getByRole('button', { name: 'Show panel' }));
  expect(screen.getByText('Start Basic match')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText('Panel options for Basic vs AI')).toHaveFocus());
});

test('only handles initiate drag and dropping produces the same ordering as movement options', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Customize this page' }));
  const handle = screen.getByRole('button', { name: /Drag Draft to reorder/ });
  expect(handle).toHaveAttribute('draggable', 'true');
  expect(screen.getByText('Open Draft setup')).not.toHaveAttribute('draggable');
  fireEvent.dragStart(handle, { dataTransfer: { setData: jest.fn() } });
  const target = document.querySelector('[data-layout-module="basic-ai"]');
  fireEvent.dragOver(target);
  expect(target).toHaveClass('is-drop-target');
  fireEvent.drop(target);
  expect(moduleOrder()).toEqual(['draft', 'basic-ai', 'ranked']);
  expect(startGame).not.toHaveBeenCalled();
});

test('page and global resets require an accessible confirmation and restore focus on cancel', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Customize this page' }));
  fireEvent.change(screen.getByLabelText('Panel options for Ranked'), { target: { value: 'first' } });
  const reset = screen.getByRole('button', { name: 'Reset this page' });
  reset.focus();
  fireEvent.click(reset);
  let dialog = screen.getByRole('dialog', { name: 'Reset Play layout?' });
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(reset).toHaveFocus();
  expect(moduleOrder()[0]).toBe('ranked');
  fireEvent.click(reset);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm reset' }));
  expect(moduleOrder()[0]).toBe('basic-ai');
  fireEvent.click(screen.getByRole('button', { name: 'Reset all page layouts' }));
  dialog = screen.getByRole('dialog', { name: 'Reset all page layouts?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm reset' }));
  expect(JSON.parse(localStorage.getItem(GUEST_LAYOUT_STORAGE_KEY)).pages).toEqual({});
});

test('guest layouts persist after remount, and storage failure retains session editing', () => {
  const first = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Customize this page' }));
  fireEvent.change(screen.getByLabelText('Panel options for Ranked'), { target: { value: 'first' } });
  first.unmount();
  render(<App />);
  expect(moduleOrder()[0]).toBe('ranked');
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  fireEvent.click(screen.getByRole('button', { name: 'Customize this page' }));
  fireEvent.change(screen.getByLabelText('Panel options for Draft'), { target: { value: 'first' } });
  expect(moduleOrder()[0]).toBe('draft');
  expect(screen.getByText(/Browser storage is unavailable/)).toBeInTheDocument();
});

test('account layout status only says saved after the authenticated API confirms', async () => {
  const save = deferred();
  fetch.mockResolvedValueOnce(response(envelope())).mockReturnValueOnce(save.promise);
  render(<App account={{ id: 'a' }} authToken="token-a" serverUrl="http://localhost:3001" />);
  await screen.findByText('Account layouts loaded.');
  fireEvent.click(screen.getByRole('button', { name: 'Customize this page' }));
  fireEvent.change(screen.getByLabelText('Panel options for Ranked'), { target: { value: 'first' } });
  expect(screen.getByText('Saving account layout…')).toBeInTheDocument();
  expect(screen.queryByText('Layout saved to your account.')).not.toBeInTheDocument();
  const request = fetch.mock.calls[1];
  expect(request[0]).toBe('http://localhost:3001/api/account/layouts');
  expect(request[1].headers.Authorization).toBe('Bearer token-a');
  const body = JSON.parse(request[1].body);
  expect(body.revision).toBe(0);
  expect(body.preferences.pages.play.order[0]).toBe('ranked');
  await act(async () => save.resolve(response(envelope(body.preferences, 1))));
  expect(screen.getByText('Layout saved to your account.')).toBeInTheDocument();
});

test('an account switch immediately removes the previous account layout and ignores its late response', async () => {
  const firstLoad = deferred();
  const secondLoad = deferred();
  fetch.mockReturnValueOnce(firstLoad.promise).mockReturnValueOnce(secondLoad.promise);
  const { rerender } = render(<App account={{ id: 'a' }} authToken="token-a" />);
  rerender(<App account={{ id: 'b' }} authToken="token-b" />);
  await act(async () => firstLoad.resolve(response(envelope(moveLayoutModule(emptyLayoutPreferences(), 'play', 'draft', 0), 4))));
  expect(moduleOrder()[0]).toBe('basic-ai');
  await act(async () => secondLoad.resolve(response(envelope(moveLayoutModule(emptyLayoutPreferences(), 'play', 'ranked', 0), 2))));
  expect(moduleOrder()[0]).toBe('ranked');
  rerender(<App />);
  expect(moduleOrder()[0]).toBe('basic-ai');
  expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer token-b');
});

test('guest/account choice never silently overwrites either layout', async () => {
  const guest = moveLayoutModule(emptyLayoutPreferences(), 'play', 'draft', 0);
  localStorage.setItem(GUEST_LAYOUT_STORAGE_KEY, JSON.stringify(guest));
  fetch.mockResolvedValueOnce(response(envelope(moveLayoutModule(emptyLayoutPreferences(), 'play', 'ranked', 0), 4)));
  render(<App account={{ id: 'a' }} authToken="token-a" />);
  await screen.findByRole('button', { name: 'Use account layouts' });
  expect(moduleOrder()[0]).toBe('ranked');
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Use account layouts' }));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem(GUEST_LAYOUT_STORAGE_KEY))).toEqual(guest);
});

test('revision conflicts require a choice and retry uses the confirmed server revision', async () => {
  fetch.mockResolvedValueOnce(response(envelope())).mockResolvedValueOnce(response(envelope(emptyLayoutPreferences(), 3), 409)).mockResolvedValueOnce(response(envelope(emptyLayoutPreferences(), 4)));
  render(<App account={{ id: 'a' }} authToken="token-a" />);
  await screen.findByText('Account layouts loaded.');
  fireEvent.click(screen.getByRole('button', { name: 'Customize this page' }));
  fireEvent.change(screen.getByLabelText('Panel options for Ranked'), { target: { value: 'first' } });
  await screen.findByRole('button', { name: 'Load account version' });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(moduleOrder()[0]).toBe('ranked');
  fireEvent.click(screen.getByRole('button', { name: 'Save this version' }));
  await screen.findByText('Layout saved to your account.');
  expect(JSON.parse(fetch.mock.calls[2][1].body).revision).toBe(3);
});

test('failed saves provide explicit retry without claiming server synchronization', async () => {
  fetch.mockResolvedValueOnce(response(envelope())).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response(envelope(emptyLayoutPreferences(), 1)));
  render(<App account={{ id: 'a' }} authToken="token-a" />);
  await screen.findByText('Account layouts loaded.');
  fireEvent.click(screen.getByRole('button', { name: 'Customize this page' }));
  fireEvent.change(screen.getByLabelText('Panel options for Ranked'), { target: { value: 'first' } });
  await screen.findByRole('button', { name: 'Retry saving layouts' });
  expect(screen.queryByText('Layout saved to your account.')).not.toBeInTheDocument();
  expect(moduleOrder()[0]).toBe('ranked');
  fireEvent.click(screen.getByRole('button', { name: 'Retry saving layouts' }));
  await screen.findByText('Layout saved to your account.');
});

test('rapid account changes serialize writes using each newly confirmed revision', async () => {
  const save = deferred();
  fetch.mockResolvedValueOnce(response(envelope())).mockReturnValueOnce(save.promise).mockResolvedValueOnce(response(envelope(emptyLayoutPreferences(), 2)));
  render(<App account={{ id: 'a' }} authToken="token-a" />);
  await screen.findByText('Account layouts loaded.');
  fireEvent.click(screen.getByRole('button', { name: 'Customize this page' }));
  fireEvent.change(screen.getByLabelText('Panel options for Ranked'), { target: { value: 'first' } });
  fireEvent.change(screen.getByLabelText('Panel options for Draft'), { target: { value: 'first' } });
  expect(fetch).toHaveBeenCalledTimes(2);
  const firstBody = JSON.parse(fetch.mock.calls[1][1].body);
  await act(async () => save.resolve(response(envelope(firstBody.preferences, 1))));
  await screen.findByText('Layout saved to your account.');
  const lastBody = JSON.parse(fetch.mock.calls[2][1].body);
  expect(lastBody.revision).toBe(1);
  expect(lastBody.preferences.pages.play.order[0]).toBe('draft');
  expect(moduleOrder()[0]).toBe('draft');
});

test('failed initial loading disables changes until an explicit retry succeeds', async () => {
  fetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response(envelope()));
  render(<App account={{ id: 'a' }} authToken="token-a" />);
  await screen.findByRole('button', { name: 'Retry loading layouts' });
  fireEvent.click(screen.getByRole('button', { name: 'Customize this page' }));
  expect(screen.getByLabelText('Panel options for Ranked')).toBeDisabled();
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading layouts' }));
  await screen.findByText('Account layouts loaded.');
  expect(screen.getByLabelText('Panel options for Ranked')).not.toBeDisabled();
});

test('selecting guest layouts saves only after the player chooses it', async () => {
  const guest = moveLayoutModule(emptyLayoutPreferences(), 'play', 'draft', 0);
  localStorage.setItem(GUEST_LAYOUT_STORAGE_KEY, JSON.stringify(guest));
  fetch.mockResolvedValueOnce(response(envelope(emptyLayoutPreferences(), 4))).mockResolvedValueOnce(response(envelope(guest, 5)));
  render(<App account={{ id: 'a' }} authToken="token-a" />);
  await screen.findByRole('button', { name: 'Use guest layouts' });
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Use guest layouts' }));
  await screen.findByText('Layout saved to your account.');
  expect(moduleOrder()[0]).toBe('draft');
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ preferences: guest, revision: 4 });
});

test('leaving the menu finishes the final queued edit with the original account credentials', async () => {
  const save = deferred();
  fetch.mockResolvedValueOnce(response(envelope())).mockReturnValueOnce(save.promise).mockResolvedValueOnce(response(envelope(emptyLayoutPreferences(), 2)));
  const { unmount } = render(<App account={{ id: 'a' }} authToken="token-a" />);
  await screen.findByText('Account layouts loaded.');
  fireEvent.click(screen.getByRole('button', { name: 'Customize this page' }));
  fireEvent.change(screen.getByLabelText('Panel options for Ranked'), { target: { value: 'first' } });
  fireEvent.change(screen.getByLabelText('Panel options for Draft'), { target: { value: 'first' } });
  unmount();
  await act(async () => save.resolve(response(envelope(emptyLayoutPreferences(), 1))));
  expect(fetch).toHaveBeenCalledTimes(3);
  const finalSave = fetch.mock.calls[2][1];
  expect(finalSave.headers.Authorization).toBe('Bearer token-a');
  expect(JSON.parse(finalSave.body).revision).toBe(1);
  expect(JSON.parse(finalSave.body).preferences.pages.play.order[0]).toBe('draft');
});

test('an old account queue cannot reuse a new account revision or paint its preferences', async () => {
  const save = deferred();
  fetch.mockResolvedValueOnce(response(envelope())).mockReturnValueOnce(save.promise).mockResolvedValueOnce(response(envelope(emptyLayoutPreferences(), 7))).mockResolvedValueOnce(response(envelope(emptyLayoutPreferences(), 2)));
  const { rerender } = render(<App account={{ id: 'a' }} authToken="token-a" />);
  await screen.findByText('Account layouts loaded.');
  fireEvent.click(screen.getByRole('button', { name: 'Customize this page' }));
  fireEvent.change(screen.getByLabelText('Panel options for Ranked'), { target: { value: 'first' } });
  fireEvent.change(screen.getByLabelText('Panel options for Draft'), { target: { value: 'first' } });
  rerender(<App account={{ id: 'b' }} authToken="token-b" />);
  await screen.findByText('Account layouts loaded.');
  await act(async () => save.resolve(response(envelope(emptyLayoutPreferences(), 1))));
  const finalSave = fetch.mock.calls[3][1];
  expect(finalSave.headers.Authorization).toBe('Bearer token-a');
  expect(JSON.parse(finalSave.body).revision).toBe(1);
  expect(moduleOrder()[0]).toBe('basic-ai');
  expect(screen.getByText('Account layouts loaded.')).toBeInTheDocument();
});

test('blocked-storage guest layouts survive entering gameplay and remounting the menu', () => {
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  const first = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Customize this page' }));
  fireEvent.change(screen.getByLabelText('Panel options for Ranked'), { target: { value: 'first' } });
  first.unmount();
  render(<App />);
  expect(moduleOrder()[0]).toBe('ranked');
  expect(screen.getByText(/Browser storage is unavailable/)).toBeInTheDocument();
});
