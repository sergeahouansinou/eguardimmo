import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RichText } from './RichText';

describe('RichText', () => {
  it('rend gras, italique et souligné en éléments, sans interpréter le HTML saisi', () => {
    const { container } = render(
      <p>
        <RichText text={'**gras** *italique* __souligné__ <img src=x onerror=alert(1)>'} />
      </p>,
    );
    expect(container.querySelector('strong')?.textContent).toBe('gras');
    expect(container.querySelector('em')?.textContent).toBe('italique');
    expect(container.querySelector('u')?.textContent).toBe('souligné');
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
