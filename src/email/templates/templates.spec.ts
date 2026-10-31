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

    it('should render flyer image when imageUrl is provided', () => {
      const element = React.createElement(CustomBroadcastEmail, {
        recipientName: 'Caleb Smith',
        subject: 'Church Update',
        message: 'Dear Caleb, check out the flyer below.',
        churchName: 'Dove Sanctuary',
        imageUrl:
          'https://api.abwog.org/public/uploads/1792601056334-762496662.jpg',
      });

      const html = renderToStaticMarkup(element);

      // Verifies the flyer image tag is rendered with the provided src URL
      expect(html).toContain(
        'src="https://api.abwog.org/public/uploads/1792601056334-762496662.jpg"',
      );
      expect(html).toContain('<img');
    });

    it('should render an unsubscribe link only when unsubscribeUrl is provided', () => {
      const withLink = renderToStaticMarkup(
        React.createElement(CustomBroadcastEmail, {
          message: 'Hello',
          churchName: 'Dove Church',
          unsubscribeUrl: 'https://api.example.org/api/v1/email/unsubscribe/t',
        }),
      );
      expect(withLink).toContain(
        'href="https://api.example.org/api/v1/email/unsubscribe/t"',
      );
      expect(withLink).toContain('Unsubscribe');

      const withoutLink = renderToStaticMarkup(
        React.createElement(CustomBroadcastEmail, { message: 'Hello' }),
      );
      expect(withoutLink).not.toContain('Unsubscribe');
    });

    it('should omit flyer image when imageUrl is undefined or omitted', () => {
      const element = React.createElement(CustomBroadcastEmail, {
        recipientName: 'Caleb Smith',
        subject: 'Church Update',
        message: 'Dear Caleb, regular text update.',
        churchName: 'Dove Sanctuary',
      });

      const html = renderToStaticMarkup(element);

      // Verifies that without imageUrl, no flyer image tag is rendered
      expect(html).not.toContain('<img');
    });
  });
});
