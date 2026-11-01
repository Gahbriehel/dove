import { TemplateRenderer } from './template-renderer';

const vars = {
  firstName: 'Sarah',
  adminName: 'Pastor John',
  churchName: 'Amazing Grace',
};

describe('TemplateRenderer', () => {
  it('replaces every placeholder', () => {
    expect(
      TemplateRenderer.render(
        'Hi {{firstName}}, {{adminName}} from {{churchName}}.',
        vars,
      ),
    ).toBe('Hi Sarah, Pastor John from Amazing Grace.');
  });

  it('ignores case and inner whitespace', () => {
    expect(
      TemplateRenderer.render(
        '{{ firstName }} {{FIRSTNAME}} {{adminname}}',
        vars,
      ),
    ).toBe('Sarah Sarah Pastor John');
  });

  it('replaces repeated placeholders', () => {
    expect(TemplateRenderer.render('{{firstName}}{{firstName}}', vars)).toBe(
      'SarahSarah',
    );
  });

  it('leaves unknown placeholders untouched', () => {
    expect(TemplateRenderer.render('Hi {{nickname}}', vars)).toBe(
      'Hi {{nickname}}',
    );
  });

  it('keeps emoji and surrounding text intact', () => {
    expect(
      TemplateRenderer.render('Happy birthday {{firstName}}! 🎉🎂', vars),
    ).toBe('Happy birthday Sarah! 🎉🎂');
  });

  it('does not re-expand placeholders found inside a value', () => {
    expect(
      TemplateRenderer.render('Hi {{firstName}}', {
        ...vars,
        firstName: '{{adminName}}',
      }),
    ).toBe('Hi {{adminName}}');
  });

  describe('findUnknownPlaceholders', () => {
    it('returns an empty list when all placeholders are allowed', () => {
      expect(
        TemplateRenderer.findUnknownPlaceholders(
          '{{ firstName }} {{churchName}}',
        ),
      ).toEqual([]);
    });

    it('lists each unknown token once', () => {
      expect(
        TemplateRenderer.findUnknownPlaceholders(
          '{{nickname}} {{firstName}} {{nickname}} {{ lastName }}',
        ),
      ).toEqual(['{{nickname}}', '{{ lastName }}']);
    });
  });
});
