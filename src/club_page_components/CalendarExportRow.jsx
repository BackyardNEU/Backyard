import React from 'react';
import { buildGoogleCalendarUrl, downloadIcsFile } from '../lib/calendarExport';

// One "Add to calendar" control, honouring the user's saved calendar_preference.
//
// Replaces a duplicated Google Cal / Apple Cal button pair that appeared twice in
// CalendarModule with identical markup. "Apple Cal" was a mislabel — .ics is not
// Apple-specific; Outlook, Fantastical and Google all import it.
//
// Falls back to 'ics' when the preference has not loaded or was never set, since that
// format works everywhere.
export const CalendarExportRow = ({ event, preference = 'ics' }) => {
    if (preference === 'google') {
        return (
            <div className="cal-export-row">
                <a
                    href={buildGoogleCalendarUrl(event)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cal-export-btn"
                >
                    Add to calendar
                </a>
            </div>
        );
    }

    return (
        <div className="cal-export-row">
            <button
                type="button"
                className="cal-export-btn"
                onClick={() => downloadIcsFile(event)}
            >
                Add to calendar
            </button>
        </div>
    );
};

export default CalendarExportRow;
