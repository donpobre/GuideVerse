/**
 * src/components/Footer/Footer.jsx
 *
 * Shared site footer — used by StaticPage and any other public-facing screen.
 * Pure presentational component, no data fetching.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Mail, Instagram, Twitter, Facebook } from 'lucide-react';
import './Footer.css';

const FOOTER_LINKS = {
  Company: [
    { label: 'About GuideVerse', to: '/about' },
    { label: 'How it works', to: '/how-it-works' },
    { label: 'Careers', to: '/careers' },
    { label: 'Blog', to: '/blog' },
  ],
  Support: [
    { label: 'Help Center', to: '/help' },
    { label: 'Safety', to: '/safety' },
    { label: 'Cancellation policy', to: '/legal/cancellation' },
    { label: 'Contact us', to: '/contact' },
  ],
  Providers: [
    { label: 'Become a Provider', to: '/become-a-provider' },
    { label: 'Provider resources', to: '/provider-resources' },
    { label: 'Community guidelines', to: '/legal/community-guidelines' },
  ],
  Legal: [
    { label: 'Terms of Service', to: '/legal/terms' },
    { label: 'Privacy Policy', to: '/legal/privacy' },
    { label: 'Cookie Policy', to: '/legal/cookies' },
  ],
};

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <div className="site-footer__logo">
              <span className="site-footer__logo-mark">G</span>
              <span className="site-footer__logo-word">GuideVerse</span>
            </div>
            <p className="site-footer__tagline">
              Book the person, not the tour. Local experts, verified and escrow-protected.
            </p>
            <div className="site-footer__trust">
              <Shield size={14} />
              <span>Every booking is escrow-protected</span>
            </div>
          </div>

          <div className="site-footer__columns">
            {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
              <div key={heading} className="site-footer__column">
                <div className="site-footer__heading">{heading}</div>
                <ul>
                  {links.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="site-footer__bottom">
          <span className="site-footer__copyright">
            © {new Date().getFullYear()} GuideVerse, Inc. All rights reserved.
          </span>

          <div className="site-footer__socials">
            <a href="mailto:hello@guideverse.com" aria-label="Email"><Mail size={16} /></a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={16} /></a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter"><Twitter size={16} /></a>
            <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={16} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
