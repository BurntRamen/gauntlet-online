import { chooseBrand, setAccountBrand } from './brandPreview';
import React from 'react';
import { render, screen } from '@testing-library/react';
import SuitFireBrand from './SuitFireBrand';
afterEach(() => setAccountBrand(null));
test('uses the approved crest separately from swappable Initiative artwork', () => {
 setAccountBrand({id:'preview',brandPreview:'suitfire'}); chooseBrand('suitfire');
 const { container, rerender } = render(<SuitFireBrand />);
 expect(screen.getByRole('img', { name: 'SuitFire' })).toHaveAttribute('src', '/brand/suitfire-v14/crest.png');
 expect(container.querySelectorAll('.suitfire-brand-art img')).toHaveLength(4);
 expect(container.querySelector('.suitfire-brand-art')).toHaveAttribute('aria-hidden', 'true');
 rerender(<SuitFireBrand full setId="unknown" />);
 expect(screen.getByRole('img', { name: 'SuitFire' })).toHaveAttribute('src', '/brand/suitfire-v14/full-logo.png');
 expect(container.querySelectorAll('.suitfire-brand-art img')).toHaveLength(4);
});
