import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import {
  calendarDate,
  dateString,
  replaceCalendarDate,
  replaceCalendarTime,
} from "../src/components/ui/dateTimeCalendar.ts";

test("changing calendar day preserves seconds and fractional precision across month/year boundaries", () => {
  assert.equal(
    replaceCalendarDate("2026-10-29T13:42:05.000001", "2026-11-02"),
    "2026-11-02T13:42:05.000001",
  );
  assert.equal(replaceCalendarDate("", "2026-10-29"), "2026-10-29T00:00:00");
  assert.equal(dateString(calendarDate(2026, 12, 1)), "2027-01-01");
  assert.equal(dateString(calendarDate(2024, 2, 0)), "2024-02-29");
  assert.equal(dateString(calendarDate(1, 0, 1)), "0001-01-01");
  assert.equal(
    replaceCalendarTime("2026-10-29T13:42:05.000001", "hour", "23"),
    "2026-10-29T23:42:05.000001",
  );
  assert.equal(
    replaceCalendarTime("2026-10-29T13:42:05.000001", "minute", "59"),
    "2026-10-29T13:59:05.000001",
  );
  assert.equal(
    replaceCalendarTime("2026-10-29T13:42:05.000001", "second", "00"),
    "2026-10-29T13:42:00.000001",
  );
  assert.equal(
    replaceCalendarTime("2026-10-29T13:42", "fraction", "000001"),
    "2026-10-29T13:42:00.000001",
  );
  assert.equal(
    replaceCalendarTime("2026-10-29T13:42:05.000001", "fraction", ""),
    "2026-10-29T13:42:05",
  );
  assert.equal(replaceCalendarTime("", "hour", "12"), "");
  for (const [part, invalid] of [
    ["hour", "24"],
    ["minute", "60"],
    ["second", "-1"],
    ["fraction", "1234567"],
  ]) {
    assert.equal(
      replaceCalendarTime("2026-10-29T13:42:05.000001", part, invalid),
      "2026-10-29T13:42:05.000001",
    );
  }
});

test("calendar has labelled keyboard buttons, selected date, leap days and keeps form submit separate", async () => {
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.tmp/ssr-date-picker",
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  try {
    const { DateTimeCalendar, DateTimePicker } = await server.ssrLoadModule(
      "/src/components/ui/DateTimePicker.tsx",
    );
    const changes = [];
    const props = {
      value: "2024-02-29T13:42:05.000001",
      month: calendarDate(2024, 1, 1),
      onMonthChange() {},
      onChange(value) {
        changes.push(value);
      },
      onClose() {},
    };
    const html = renderToStaticMarkup(h(DateTimeCalendar, props));
    assert.equal((html.match(/aria-label="Chọn ngày /g) ?? []).length, 29);
    assert.match(html, /aria-label="Chọn ngày 2024-02-29" aria-pressed="true"/);
    assert.match(html, /Tháng trước/);
    assert.match(html, /Tháng sau/);
    for (const label of ["Giờ", "Phút", "Giây"])
      assert.match(html, new RegExp(`aria-label="${label}"`));
    assert.match(html, /Thời gian \(UTC\+7\)/);
    assert.match(html, /value="000001"/);
    assert.ok(html.indexOf("Thời gian") < html.indexOf(">Xóa</button>"));
    assert.doesNotMatch(html, /type="submit"|<select/);
    assert.equal((html.match(/type="number"/g) ?? []).length, 3);
    assert.match(html, /min="0" max="23"/);
    assert.equal((html.match(/max="59"/g) ?? []).length, 2);
    assert.match(html, /<fieldset class="min-w-0 space-y-3 border-0 p-0"/);
    const picker = DateTimePicker; // The complete control retains its native editable input and error association.
    const input = renderToStaticMarkup(
      h(picker, {
        id: "from",
        name: "from",
        label: "Từ (UTC+7)",
        value: props.value,
        onChange: props.onChange,
        onBlur() {},
        invalid: true,
        describedBy: "from-error",
      }),
    );
    assert.match(input, /type="datetime-local"/);
    assert.match(input, /step="any"/);
    assert.match(input, /aria-invalid="true"/);
    assert.match(input, /aria-describedby="from-error"/);
    assert.match(input, /Mở lịch Từ \(UTC\+7\)/);
    assert.equal(changes.length, 0, "Rendering must never change draft values or submit the form");
  } finally {
    await server.close();
  }
});
