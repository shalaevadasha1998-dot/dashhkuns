const CONFIG = {
  timezone: 'Europe/Moscow',
  slotMinutes: 30,
  bufferMinutes: 15,
  minNoticeHours: 12,
  horizonDays: 14,
  maxBookingsPerDay: 3,
  workStartHour: 12,
  workEndHour: 19,
  ownerEmail: 'shalaevadasha1998@gmail.com',
  notifyEmail: 'shalaevadasha1998@gmail.com',
  busyCalendarIds: [
    'primary',
    'dantkbarc9r35cgu8g9ss5bfdo@group.calendar.google.com'
  ]
};

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'availability');
    if (action !== 'availability') return json_({ ok: false, error: 'unknown_action' });
    return json_({ ok: true, timezone: CONFIG.timezone, days: buildAvailability_() });
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: 'availability_failed' });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (payload.action !== 'book') return json_({ ok: false, error: 'unknown_action' });

    const name = clean_(payload.name, 160);
    const email = clean_(payload.email, 320).toLowerCase();
    const contact = clean_(payload.contact, 320);
    const details = clean_(payload.details, 5000);
    const startIso = clean_(payload.start, 80);
    const leadId = clean_(payload.leadId, 100);

    if (!name || !email || !details || !startIso || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json_({ ok: false, error: 'required_fields' });
    }

    const start = new Date(startIso);
    if (Number.isNaN(start.getTime())) return json_({ ok: false, error: 'invalid_start' });
    const end = new Date(start.getTime() + CONFIG.slotMinutes * 60000);

    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      if (!slotAllowed_(start, end)) {
        return json_({ ok: false, error: 'slot_unavailable' });
      }

      const description = [
        'заявка с dashhkuns.com',
        '',
        'имя: ' + name,
        'email: ' + email,
        'контакт: ' + (contact || 'не указан'),
        'lead id: ' + (leadId || 'нет'),
        '',
        'задача:',
        details
      ].join('\n');

      const created = createCalendarEvent_({
        name,
        email,
        description,
        start,
        end
      });

      if (!created || !created.eventId) {
        return json_({ ok: false, error: 'calendar_create_failed' });
      }

      try {
        MailApp.sendEmail({
          to: CONFIG.notifyEmail,
          subject: 'новый созвон / ' + name,
          body: [
            'новый созвон с dashhkuns.com',
            '',
            'имя: ' + name,
            'email: ' + email,
            'контакт: ' + (contact || 'не указан'),
            'когда: ' + formatMoscow_(start) + ' мск',
            '',
            'задача:',
            details,
            '',
            'meet: ' + (created.meetUrl || 'ссылка будет в событии календаря'),
            'calendar: ' + (created.eventUrl || '')
          ].join('\n')
        });
      } catch (mailError) {
        console.error('notification failed', mailError);
      }

      return json_({
        ok: true,
        eventId: created.eventId,
        eventUrl: created.eventUrl || '',
        meetUrl: created.meetUrl || '',
        start: start.toISOString(),
        end: end.toISOString(),
        display: formatMoscow_(start)
      });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: 'booking_failed' });
  }
}

function createCalendarEvent_(input) {
  const resource = {
    summary: 'созвон / ' + input.name,
    description: input.description,
    start: { dateTime: input.start.toISOString(), timeZone: CONFIG.timezone },
    end: { dateTime: input.end.toISOString(), timeZone: CONFIG.timezone },
    attendees: [{ email: input.email }],
    conferenceData: {
      createRequest: {
        requestId: Utilities.getUuid(),
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    },
    reminders: { useDefault: true }
  };

  try {
    const created = Calendar.Events.insert(resource, 'primary', {
      conferenceDataVersion: 1,
      sendUpdates: 'all'
    });

    let fresh = created;
    if (!fresh.hangoutLink && fresh.id) {
      Utilities.sleep(700);
      fresh = Calendar.Events.get('primary', fresh.id);
    }

    return {
      eventId: fresh.id || created.id,
      eventUrl: fresh.htmlLink || created.htmlLink || '',
      meetUrl: fresh.hangoutLink || created.hangoutLink || ''
    };
  } catch (advancedError) {
    console.error('advanced calendar insert failed', advancedError);
  }

  try {
    const calendar = CalendarApp.getDefaultCalendar();
    const event = calendar.createEvent(
      'созвон / ' + input.name,
      input.start,
      input.end,
      {
        description: input.description,
        guests: input.email,
        sendInvites: true
      }
    );
    return {
      eventId: event.getId(),
      eventUrl: '',
      meetUrl: ''
    };
  } catch (fallbackError) {
    console.error('calendar fallback failed', fallbackError);
    return null;
  }
}

// Build the complete two-week calendar with only one getEvents call per busy calendar.
// The previous implementation made hundreds of calls, exceeding the edge proxy timeout.
function buildAvailability_() {
  const now = new Date();
  const firstAllowedMs = now.getTime() + CONFIG.minNoticeHours * 3600000;
  const firstDay = Utilities.formatDate(now, CONFIG.timezone, 'yyyy-MM-dd');
  const startRange = new Date(firstDay + 'T00:00:00+03:00');
  const endRange = new Date(startRange.getTime() + CONFIG.horizonDays * 86400000);
  const bufferMs = CONFIG.bufferMinutes * 60000;
  const meetingMs = CONFIG.slotMinutes * 60000;

  // Fail closed when a required calendar cannot be read: never publish
  // 'available' slots while one of the busy sources is inaccessible.
  const calendars = CONFIG.busyCalendarIds.map(id => {
    const calendar = id === 'primary'
      ? CalendarApp.getDefaultCalendar()
      : CalendarApp.getCalendarById(id);
    if (!calendar) throw new Error('calendar_not_accessible: ' + id);
    return { id, events: calendar.getEvents(startRange, endRange) };
  });
  const primary = calendars.find(c => c.id === 'primary');
  if (!primary) throw new Error('primary_calendar_missing');

  const busy = calendars.reduce((all, item) => {
    item.events.forEach(event => all.push({
      startMs: event.getStartTime().getTime(),
      endMs: event.getEndTime().getTime()
    }));
    return all;
  }, []);
  const siteMeetings = primary.events.filter(event =>
    String(event.getTitle() || '').startsWith('созвон / ')
  );
  const days = [];

  for (let offset = 0; offset < CONFIG.horizonDays; offset++) {
    const day = new Date(startRange.getTime() + offset * 86400000);
    const date = Utilities.formatDate(day, CONFIG.timezone, 'yyyy-MM-dd');
    const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
    if (weekday === 0 || weekday === 6) continue;

    const startDay = new Date(date + 'T' + String(CONFIG.workStartHour).padStart(2,'0') + ':00:00+03:00');
    const endDay = new Date(date + 'T' + String(CONFIG.workEndHour).padStart(2,'0') + ':00:00+03:00');
    const existingSiteBookings = siteMeetings.filter(event =>
      event.getStartTime() < endDay && event.getEndTime() > startDay
    ).length;
    if (existingSiteBookings >= CONFIG.maxBookingsPerDay) continue;

    const slots = [];
    for (let ms = startDay.getTime(); ms + meetingMs <= endDay.getTime(); ms += 30 * 60000) {
      const slotEnd = ms + meetingMs;
      if (ms <= firstAllowedMs) continue;
      if (busy.some(event => ms < event.endMs + bufferMs && slotEnd > event.startMs - bufferMs)) continue;
      const start = new Date(ms);
      slots.push({
        start: isoMoscow_(start),
        time: Utilities.formatDate(start, CONFIG.timezone, 'HH:mm')
      });
    }

    if (slots.length) days.push({
      date,
      weekday: Utilities.formatDate(day, CONFIG.timezone, 'EEE'),
      label: Utilities.formatDate(day, CONFIG.timezone, 'd MMM'),
      slots
    });
  }
  return days;
}

function slotAllowed_(start, end) {
  const now = new Date();
  if (start.getTime() - now.getTime() < CONFIG.minNoticeHours * 3600000) return false;

  const weekday = Number(Utilities.formatDate(start, CONFIG.timezone, 'u'));
  if (weekday > 5) return false;

  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const workStart = atMoscow_(dayStart, CONFIG.workStartHour, 0);
  const workEnd = atMoscow_(dayStart, CONFIG.workEndHour, 0);

  if (start < workStart || end > workEnd) return false;
  if (siteBookingCount_(workStart, workEnd) >= CONFIG.maxBookingsPerDay) return false;
  return !isBusy_(start, end);
}

function isBusy_(start, end) {
  const bufferMs = CONFIG.bufferMinutes * 60000;
  const from = new Date(start.getTime() - bufferMs);
  const to = new Date(end.getTime() + bufferMs);

  for (const id of CONFIG.busyCalendarIds) {
    const calendar = id === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(id);
    if (!calendar) continue;
    const events = calendar.getEvents(from, to);
    if (events.some(event => {
      if (event.isAllDayEvent()) return true;
      const eventStart = new Date(event.getStartTime().getTime() - bufferMs);
      const eventEnd = new Date(event.getEndTime().getTime() + bufferMs);
      return start < eventEnd && end > eventStart;
    })) return true;
  }
  return false;
}

function siteBookingCount_(dayStart, dayEnd) {
  const calendar = CalendarApp.getDefaultCalendar();
  return calendar.getEvents(dayStart, dayEnd).filter(event => String(event.getTitle() || '').startsWith('созвон / ')).length;
}

function atMoscow_(day, hour, minute) {
  const date = Utilities.formatDate(day, CONFIG.timezone, 'yyyy-MM-dd');
  return new Date(date + 'T' + String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ':00+03:00');
}

function isoMoscow_(date) {
  return Utilities.formatDate(date, CONFIG.timezone, "yyyy-MM-dd'T'HH:mm:ss'+03:00'");
}

function formatMoscow_(date) {
  return Utilities.formatDate(date, CONFIG.timezone, 'dd.MM.yyyy HH:mm');
}

function clean_(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
