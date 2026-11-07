import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { chooseBrand, setAccountBrand, useAccountBrand } from './brandPreview';
import SuitFireBrand from './SuitFireBrand';
import BrandChoice from './BrandChoice';
import PlayerShell from '../navigation/PlayerShell';

const allowed = name => ({ id: name + '-id', name, brandPreview: 'suitfire' });
function Harness({ account }) {
  useAccountBrand(account);
  return <PlayerShell account={account} destination="settings" onNavigate={() => {}}><BrandChoice /></PlayerShell>;
}
beforeEach(() => { localStorage.clear(); setAccountBrand(null); });
afterEach(() => act(() => setAccountBrand(null)));

test.each(['simply', 'BurntRamen'])('%s can choose either brand, and the choice survives a session reload', name => {
 const account = allowed(name);
 const view = render(<Harness account={account} />);
 expect(screen.getByRole('radio', { name: 'Gauntlet Online' })).toBeChecked();
 expect(screen.getByRole('button', { name: 'Gauntlet Online — open Play' })).toBeInTheDocument();
 fireEvent.click(screen.getByRole('radio', { name: 'SuitFire preview' }));
 expect(screen.getByRole('button', { name: 'SuitFire — open Play' })).toBeInTheDocument();
 expect(document.title).toBe('SuitFire');
 view.unmount();
 render(<Harness account={account} />);
 expect(screen.getByRole('radio', { name: 'SuitFire preview' })).toBeChecked();
 fireEvent.click(screen.getByRole('radio', { name: 'Gauntlet Online' }));
 expect(document.title).toBe('Gauntlet Online');
 expect(screen.getByRole('img', { name: 'Gauntlet Online' })).toBeInTheDocument();
});

test('logout and account switching restore the public identity and do not copy another account choice', () => {
 const { rerender } = render(<Harness account={allowed('simply')} />);
 fireEvent.click(screen.getByRole('radio', { name: 'SuitFire preview' }));
 rerender(<Harness account={allowed('BurntRamen')} />);
 expect(screen.getByRole('radio', { name: 'Gauntlet Online' })).toBeChecked();
 rerender(<Harness account={null} />);
 expect(screen.queryByRole('group', { name: 'Game appearance' })).not.toBeInTheDocument();
 expect(document.title).toBe('Gauntlet Online');
 rerender(<Harness account={allowed('simply')} />);
 expect(screen.getByRole('radio', { name: 'SuitFire preview' })).toBeChecked();
});

test('names, stored preferences, and an unauthorized selection cannot enable the preview', () => {
 localStorage.setItem('gauntlet_brand_preference:ordinary', 'suitfire');
 render(<Harness account={{ id: 'ordinary', name: 'simply', displayName: 'BurntRamen' }} />);
 act(() => chooseBrand('suitfire'));
 expect(screen.queryByRole('radio')).not.toBeInTheDocument();
 expect(document.title).toBe('Gauntlet Online');
 expect(screen.queryByRole('img', { name: 'SuitFire' })).not.toBeInTheDocument();
});

test('selected preview uses the untouched approved full logo and a separate art layer', () => {
 setAccountBrand(allowed('simply')); chooseBrand('suitfire');
 const { container } = render(<SuitFireBrand full />);
 expect(screen.getByRole('img', { name: 'SuitFire' })).toHaveAttribute('src', '/brand/suitfire-v14/full-logo.png');
 expect(container.querySelectorAll('.suitfire-brand-art img')).toHaveLength(4);
});
