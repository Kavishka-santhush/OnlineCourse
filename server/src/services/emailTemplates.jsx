import React from 'react';
import { render } from '@react-email/render';
import {
  Html, Head, Body, Container, Heading, Text, Button, Hr, Preview,
} from '@react-email/components';
import { env } from '../config/env.js';

const brand = { bg: '#0f172a', accent: '#6366f1', text: '#334155', muted: '#64748b' };
const wrap = { fontFamily: 'Inter, Arial, sans-serif', backgroundColor: '#f8fafc', padding: '24px', color: brand.text };
const card = { backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px', maxWidth: '560px', margin: '0 auto', boxShadow: '0 1px 3px rgba(0,0,0,.08)' };

function Shell({ preview, title, children, cta, ctaUrl }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={wrap}>
        <Container style={card}>
          <Heading as="h1" style={{ fontSize: '20px', color: brand.bg, margin: '0 0 16px' }}>{title}</Heading>
          {children}
          {cta && ctaUrl ? (
            <Button href={ctaUrl} style={{ backgroundColor: brand.accent, color: '#fff', padding: '12px 20px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block', marginTop: '16px' }}>
              {cta}
            </Button>
          ) : null}
          <Hr style={{ borderColor: '#e2e8f0', margin: '28px 0 12px' }} />
          <Text style={{ fontSize: '12px', color: brand.muted }}>CourseMarket · sent to your account email · <a href={env.frontendUrl} style={{ color: brand.muted }}>Manage preferences</a></Text>
        </Container>
      </Body>
    </Html>
  );
}

const render_ = (el) => render(el);

export const templates = {
  welcome: ({ name, email }, ctx = {}) => render_(
    <Shell preview="Welcome aboard" title={`Welcome, ${name}!`} {...ctx}>
      <Text>Your {ctx.role === 'instructor' ? 'instructor' : 'learner'} account is ready. Explore thousands of courses and start learning today.</Text>
    </Shell>,
  ),
  purchase: ({ name, courseTitle, amount }, ctx = {}) => render_(
    <Shell preview="Order confirmed" title="Purchase confirmed 🎉" {...ctx}>
      <Text>Hi {name}, you are now enrolled in <strong>{courseTitle}</strong>.</Text>
      <Text>Total charged: <strong>{amount}</strong></Text>
    </Shell>,
  ),
  newLesson: ({ name, courseTitle, lessonTitle }, ctx = {}) => render_(
    <Shell preview="New lesson published" title={`New lesson in ${courseTitle}`} {...ctx}>
      <Text>A new lesson <strong>{lessonTitle}</strong> was just published.</Text>
    </Shell>,
  ),
  assignmentGraded: ({ name, courseTitle, score }, ctx = {}) => render_(
    <Shell preview="Assignment graded" title="Your assignment was graded" {...ctx}>
      <Text>Your submission for <strong>{courseTitle}</strong> received a score of <strong>{score}/100</strong>.</Text>
    </Shell>,
  ),
  certificate: ({ name, courseTitle }, ctx = {}) => render_(
    <Shell preview="Certificate issued" title={`Certificate earned, ${name}!`} {...ctx}>
      <Text>Congratulations on completing <strong>{courseTitle}</strong>. Your certificate is available in your dashboard.</Text>
    </Shell>,
  ),
  liveClassReminder: ({ name, title, startsAt }, ctx = {}) => render_(
    <Shell preview="Live class starting soon" title="Live class starting soon" {...ctx}>
      <Text>Hi {name}, <strong>{title}</strong> starts at {startsAt}. Don't miss it!</Text>
    </Shell>,
  ),
  instructorApproved: ({ name }, ctx = {}) => render_(
    <Shell preview="Instructor application approved" title="You're now an instructor 🎓" {...ctx}>
      <Text>Hi {name}, your instructor application has been approved. You can now create and publish courses.</Text>
    </Shell>,
  ),
  courseReviewed: ({ name, courseTitle, rating }, ctx = {}) => render_(
    <Shell preview="New review" title={`New ${rating}★ review on ${courseTitle}`} {...ctx}>
      <Text>Your course <strong>{courseTitle}</strong> received a new {rating}-star review.</Text>
    </Shell>,
  ),
  payout: ({ name, amount }, ctx = {}) => render_(
    <Shell preview="Payout processed" title="Payout processed 💸" {...ctx}>
      <Text>Hi {name}, a payout of <strong>{amount}</strong> has been sent to your connected account.</Text>
    </Shell>,
  ),
  priceDrop: ({ name, courseTitle, price }, ctx = {}) => render_(
    <Shell preview="Price drop" title={`Price drop on your wishlist: ${courseTitle}`} {...ctx}>
      <Text><strong>{courseTitle}</strong> is now <strong>{price}</strong>. It's on your wishlist!</Text>
    </Shell>,
  ),
  refundResolved: ({ name, courseTitle, approved }, ctx = {}) => render_(
    <Shell preview="Refund update" title={`Refund ${approved ? 'approved' : 'declined'}`} {...ctx}>
      <Text>Your refund request for <strong>{courseTitle}</strong> was {approved ? 'approved — funds will be returned within 5-10 business days.' : 'declined. Contact support for details.'}</Text>
    </Shell>,
  ),
  announcement: ({ name, title, body }, ctx = {}) => render_(
    <Shell preview={title} title={title} {...ctx}>
      <Text>{body}</Text>
    </Shell>,
  ),
  generic: ({ subject, title, message }, ctx = {}) => render_(
    <Shell preview={subject} title={title} {...ctx}>
      <Text>{message}</Text>
    </Shell>,
  ),
};
