export const NOTICE_KEY = 'pendingNote';

export const RELEASE_NOTES = Object.freeze({
  '1.1.0': 'releaseNote110',
  '1.2.0': 'releaseNote120',
});

export function noteForVersion(version) {
  return RELEASE_NOTES[version] || null;
}
