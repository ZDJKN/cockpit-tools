import { describe, expect, it } from 'vitest';

import { applicationUpdatePolicy } from './applicationUpdatePolicy';

describe('enterprise application update policy', () => {
  it('disables every application update entry point', () => {
    expect(applicationUpdatePolicy).toEqual({
      allowBackgroundChecks: false,
      allowManualChecks: false,
      showUpdatePrompts: false,
      showPostUpdateNotices: false,
      allowUpstreamAnnouncements: false,
    });
  });
});
