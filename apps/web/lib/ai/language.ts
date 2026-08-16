/**
 * One rule for what language every AI feature answers in.
 *
 * The routes used to decide this separately, and two of them decided it from
 * what the student happened to type rather than from the account. So an Urdu
 * student who typed a question in Roman letters, which is how most people type
 * Urdu on a phone, got Roman Urdu back, and the coach card was told in as many
 * words to write Roman Urdu always. The client's note was blunt about it: when
 * the app is in Urdu, the app writes Urdu.
 *
 * The account language decides, never the keyboard. What stays in Latin is
 * what a Pakistani classroom leaves in Latin anyway: the technical terms, the
 * board's own initials, and every number.
 */
export function languageRule(language: string | undefined): string {
  if (language !== 'ur') {
    return 'Write in simple English, the way a good Pakistani teacher explains to a fourteen-year-old.';
  }
  return (
    'Write in Urdu, in Urdu script. This is not optional and it does not depend on how the student typed: ' +
    'even if their question is in Roman letters or in English, you answer in Urdu script. ' +
    'Never reply in Roman Urdu (Urdu spelled in English letters). ' +
    'Keep in Latin script only what an Urdu-medium textbook keeps in Latin: subject and technical terms ' +
    '(photosynthesis, velocity, algorithm), chemical formulae and equations, and all digits and numbers. ' +
    'Write the way an Urdu-medium teacher in Islamabad speaks to a Class 9 student: warm, plain, not literary.'
  );
}
