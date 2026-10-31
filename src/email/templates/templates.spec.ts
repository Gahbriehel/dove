jest.mock('../utils/sanitize-html.util', () => ({
  isHtmlContent: (val: string) => /<\/?[a-z][\s\S]*>/i.test(val),
  sanitizeEmailHtml: (html: string) => html,
}));

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BirthdayGreetingEmail } from './birthday-greeting.template';
import { CustomBroadcastEmail } from './custom-broadcast.template';
import { PlainMessageEmail } from './plain-message.template';

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

  describe('PlainMessageEmail', () => {
    it('should render a minimal letter-style layout without campaign chrome', () => {
      const html = renderToStaticMarkup(
        React.createElement(PlainMessageEmail, {
          heading: 'Come Let Us Give Thanks',
          message: 'Dearly Beloved,\n\nJoin us this Sunday.',
          churchName: 'Abiding Word of Grace Missions',
          contactEmail: 'info@abwog.org',
        }),
      );

      expect(html).toContain('Come Let Us Give Thanks');
      expect(html).toContain('Dearly Beloved,');
      expect(html).toContain('Join us this Sunday.');
      expect(html).toContain('Abiding Word of Grace Missions');
      expect(html).toContain('info@abwog.org');
      expect(html).not.toContain('Need assistance or have questions?');
      expect(html).not.toContain('Sent via');
      expect(html).not.toContain('box-shadow');
      expect(html).not.toContain('<img');
    });

    it('should render rich HTML messages, an optional image and a text link CTA', () => {
      const html = renderToStaticMarkup(
        React.createElement(PlainMessageEmail, {
          message: '<p>Hello <strong>friend</strong></p>',
          imageUrl: 'https://example.org/flyer.png',
          ctaLabel: 'RSVP',
          ctaUrl: 'https://example.org/rsvp',
        }),
      );

      expect(html).toContain('<strong>friend</strong>');
      expect(html).toContain('src="https://example.org/flyer.png"');
      expect(html).toContain('href="https://example.org/rsvp"');
      expect(html).toContain('RSVP');
    });
  });
});
