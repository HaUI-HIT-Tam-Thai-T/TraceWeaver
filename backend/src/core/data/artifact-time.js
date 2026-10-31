// SPDX-FileCopyrightText: 2026 TraceWeaver contributors
// SPDX-License-Identifier: Apache-2.0

// Inclusive instants: avoid PostgreSQL rounding a fractional query across a boundary.
function bound(value, lower) {
  if (!value) return [null, 0];
  const fraction = value.includes('.') ? value.slice(20, -1) : '';
  return [
    value.slice(0, 19) + 'Z',
    Number(fraction.padEnd(6, '0').slice(0, 6)) +
      (lower && /[1-9]/.test(fraction.slice(6)) ? 1 : 0),
  ];
}
export const artifactTimeValues = ({ from, to }) => [...bound(from, true), ...bound(to, false)];
export function artifactTimeScope(start) {
  const time = "(r.document->>'created_at')::timestamptz";
  return `($${start}::timestamptz IS NULL OR ${time} >= ($${start}::timestamptz + $${start + 1}::int*interval '1 microsecond'))
    AND ($${start + 2}::timestamptz IS NULL OR ${time} <= ($${start + 2}::timestamptz + $${start + 3}::int*interval '1 microsecond'))`;
}
