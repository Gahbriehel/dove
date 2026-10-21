jest.mock('../utils/sanitize-html.util', () => ({
  isHtmlContent: (val: string) => /<\/?[a-z][\s\S]*>/i.test(val),
  sanitizeEmailHtml: (html: string) => html,
}));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BirthdayGreetingEmail } from './birthday-greeting.template';
import { CustomBroadcastEmail } from './custom-broadcast.template';

describe('Email Templates', () => {
  describe('BirthdayGreetingEmail', () => {
    it('should render HTML without hardcoded "Hello firstName" greeting', () => {
      const element = React.createElement(BirthdayGreetingEmail, {
        recipientName: 'Jane Doe',
        subject: 'Happy Birthday Jane!',
        message: 'Wishing you a wonderful celebration and blessed year ahead!',
        churchName: 'Grace Church',
        contactEmail: 'pastor@grace.org',
        contactPhone: '+1-555-1234',
      });

      const html = renderToStaticMarkup(element);
      // Verifies the template does NOT inject an unwanted "Hello Jane"
      expect(html).not.toContain('Hello <strong>Jane Doe</strong>');
      expect(html).not.toContain('Hello <strong>Jane</strong>');

      // Verifies content rendering
      expect(html).toContain('Happy Birthday Jane!');
      expect(html).toContain('Grace Church');
      expect(html).toContain('Wishing you a wonderful celebration');
      expect(html).toContain('pastor@grace.org');

      // Verifies absence of promotional "ANNOUNCEMENT" badge
      expect(html).not.toContain('ANNOUNCEMENT');
    });

    it('should support rich HTML message content correctly', () => {
      const element = React.createElement(BirthdayGreetingEmail, {
        subject: 'Happy Birthday John!',
        message: '<p>Dear John,</p><p>God bless you abundantly!</p>',
        churchName: 'Living Hope Church',
      });

      const html = renderToStaticMarkup(element);
      expect(html).toContain('Dear John,');
      expect(html).toContain('God bless you abundantly!');
    });
  });

  describe('CustomBroadcastEmail', () => {
    it('should render message without unneeded "Hello firstName" line', () => {
      const element = React.createElement(CustomBroadcastEmail, {
        recipientName: 'Caleb Smith',
        subject: 'Church Update',
        message: 'Dear Caleb, service times have changed.',
        churchName: 'Dove Sanctuary',
      });

      const html = renderToStaticMarkup(element);

      // Should not contain the redundant "Hello Caleb Smith," greeting line
      expect(html).not.toContain('Hello <strong>Caleb Smith</strong>');

      // The author\'s custom message should be intact
      expect(html).toContain('Dear Caleb, service times have changed.');
    });
  });
});
