import { describe, it, expect, vi } from 'vitest';
import { buildGoogleCalendarUrl, downloadIcsFile } from '../src/lib/calendarExport.js';

const mockEvent = {
  id: 'abc-123',
  club_name: 'Robotics Club',
  event_description: 'Weekly build session',
  start_time: '2026-08-01T18:00:00Z',
  end_time: '2026-08-01T20:00:00Z',
};

describe('buildGoogleCalendarUrl', () => {
  it('returns a valid Google Calendar URL', () => {
    const url = buildGoogleCalendarUrl(mockEvent);
    expect(url).toContain('https://calendar.google.com/calendar/render');
  });

  it('includes the club name as the event title', () => {
    const url = buildGoogleCalendarUrl(mockEvent);
    expect(url).toContain('text=Robotics+Club');
  });

  it('includes the description', () => {
    const url = buildGoogleCalendarUrl(mockEvent);
    expect(url).toContain('details=Weekly+build+session');
  });

  it('formats dates in YYYYMMDDTHHmmssZ format', () => {
    const url = buildGoogleCalendarUrl(mockEvent);
    expect(url).toContain('dates=20260801T180000Z');
    expect(url).toContain('20260801T200000Z');
  });

  it('handles missing description gracefully', () => {
    const event = { ...mockEvent, event_description: undefined };
    const url = buildGoogleCalendarUrl(event);
    expect(url).toContain('details=');
  });

  it('handles missing club name gracefully', () => {
    const event = { ...mockEvent, club_name: undefined };
    const url = buildGoogleCalendarUrl(event);
    expect(url).toContain('text=Club+Event');
  });

  it('encodes special characters in title and description', () => {
    const event = {
      ...mockEvent,
      club_name: 'Arts & Crafts',
      event_description: 'Fun, friends & food!',
    };
    const url = buildGoogleCalendarUrl(event);
    expect(url).toContain('Arts');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('text')).toBe('Arts & Crafts');
    expect(parsed.searchParams.get('details')).toBe('Fun, friends & food!');
  });
});

describe('downloadIcsFile', () => {
  it('generates valid .ics content and triggers download', () => {
    const clicks = [];
    const appended = [];
    const removed = [];

    const mockAnchor = {
      set href(v) { this._href = v; },
      get href() { return this._href; },
      download: '',
      click: function () { clicks.push(this._href); },
    };

    vi.stubGlobal('document', {
      createElement: () => mockAnchor,
      body: {
        appendChild: (el) => appended.push(el),
        removeChild: (el) => removed.push(el),
      },
    });

    const revokedUrls = [];
    vi.stubGlobal('URL', {
      createObjectURL: (blob) => {
        expect(blob.type).toBe('text/calendar;charset=utf-8');
        return 'blob:mock-url';
      },
      revokeObjectURL: (url) => revokedUrls.push(url),
    });

    downloadIcsFile(mockEvent);

    expect(clicks).toHaveLength(1);
    expect(mockAnchor.download).toBe('event.ics');
    expect(appended).toHaveLength(1);
    expect(removed).toHaveLength(1);
    expect(revokedUrls).toContain('blob:mock-url');

    vi.unstubAllGlobals();
  });

  it('escapes commas and semicolons in .ics fields', () => {
    let capturedBlob = null;

    const mockAnchor = {
      href: '',
      download: '',
      click: () => {},
    };

    vi.stubGlobal('document', {
      createElement: () => mockAnchor,
      body: { appendChild: () => {}, removeChild: () => {} },
    });

    vi.stubGlobal('URL', {
      createObjectURL: (blob) => {
        capturedBlob = blob;
        return 'blob:test';
      },
      revokeObjectURL: () => {},
    });

    vi.stubGlobal('Blob', class {
      constructor(parts, opts) {
        this.content = parts.join('');
        this.type = opts.type;
      }
    });

    const event = {
      ...mockEvent,
      club_name: 'Art, Design; Club',
      event_description: 'Paint, draw; create',
    };

    downloadIcsFile(event);

    expect(capturedBlob.content).toContain('SUMMARY:Art\\, Design\\; Club');
    expect(capturedBlob.content).toContain('DESCRIPTION:Paint\\, draw\\; create');
    expect(capturedBlob.content).toContain('UID:abc-123@backyard.app');
    expect(capturedBlob.content).toContain('BEGIN:VCALENDAR');
    expect(capturedBlob.content).toContain('END:VCALENDAR');

    vi.unstubAllGlobals();
  });

  it('strips control characters from .ics text', () => {
    let capturedBlob = null;

    vi.stubGlobal('document', {
      createElement: () => ({ href: '', download: '', click: () => {} }),
      body: { appendChild: () => {}, removeChild: () => {} },
    });
    vi.stubGlobal('URL', {
      createObjectURL: (blob) => { capturedBlob = blob; return 'blob:test'; },
      revokeObjectURL: () => {},
    });
    vi.stubGlobal('Blob', class {
      constructor(parts, opts) { this.content = parts.join(''); this.type = opts.type; }
    });

    const event = {
      ...mockEvent,
      event_description: 'Hello\x00\x01\x02World',
    };

    downloadIcsFile(event);
    expect(capturedBlob.content).toContain('DESCRIPTION:HelloWorld');

    vi.unstubAllGlobals();
  });
});
