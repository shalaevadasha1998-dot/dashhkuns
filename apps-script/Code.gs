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

      const event = {
        summary: 'созвон / ' + name,
        description: [
          'заявка с dashhkuns.com',
          '',
          'имя: ' + name,
          'email: ' + email,
          'контакт: ' + (contact || 'не указан'),
          'lead id: ' + (leadId || 'нет'),
          '',
          'задача:',
          details
        ].join('\n'),
        start: { dateTime: start.toISOString(), timeZone: CONFIG.timezone },
        end: { dateTime: end.toISOString(), timeZone: CONFIG.timezone },
        attendees: [{ email }],
        conferenceData: {
          createRequest: {
            requestId: Utilities.getUuid(),
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        },
        reminders: { useDefault: true }
      };

      const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all';
      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(event),
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true
      });

      const status = response.getResponseCode();
      const created = JSON.parse(response.getContentText() || '{}');
      if (status < 200 || status >= 300 || !created.id) {
        console.error('calendar insert failed', status, created);
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
            'meet: ' + (created.hangoutLink || 'создаётся'),
            'calendar: ' + (created.htmlLink || '')
          ].join('\n')
        });
      } catch (mailError) {
        console.error('notification failed', mailError);
      }

      return json_({
        ok: true,
        eventId: created.id,
        eventUrl: created.htmlLink || '',
        meetUrl: created.hangoutLink || '',
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

function buildAvailability_() {
  const now = new Date();
  const firstAllowed = new Date(now.getTime() + CONFIG.minNoticeHours * 3600000);
  const days = [];

  for (let offset = 0; offset < CONFIG.horizonDays; offset++) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + offset);
    const weekday = Number(Utilities.formatDate(day, CONFIG.timezone, 'u'));
    if (weekday > 5) continue;

    const slots = [];
    const startDay = atMoscow_(day, CONFIG.workStartHour, 0);
    const endDay = atMoscow_(day, CONFIG.workEndHour, 0);

    if (siteBookingCount_(startDay, endDay) >= CONFIG.maxBookingsPerDay) continue;

    for (let t = new Date(startDay); t.getTime() + CONFIG.slotMinutes * 60000 <= endDay.getTime(); t = new Date(t.getTime() + 30 * 60000)) {
      const slotEnd = new Date(t.getTime() + CONFIG.slotMinutes * 60000);
      if (t <= firstAllowed) continue;
      if (!isBusy_(t, slotEnd)) {
        slots.push({
          start: isoMoscow_(t),
          time: Utilities.formatDate(t, CONFIG.timezone, 'HH:mm')
        });
      }
    }

    if (slots.length) {
      days.push({
        date: Utilities.formatDate(day, CONFIG.timezone, 'yyyy-MM-dd'),
        weekday: Utilities.formatDate(day, CONFIG.timezone, 'EEE'),
        label: Utilities.formatDate(day, CONFIG.timezone, 'd MMM'),
        slots
      });
    }
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
