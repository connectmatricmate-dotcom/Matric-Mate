/**
 * Renders AI text as real typography instead of literal asterisks.
 *
 * The parser lives in @matricmate/core, so this draws exactly the blocks the
 * website draws, from the same rules. Urdu-aware: a block in Arabic script
 * gets the Nastaliq treatment and flips its bullet to the right.
 */
import { View } from 'react-native';
import { type MdSpan, isUrduScript, parseMarkdown } from '@matricmate/core';
import { C, F, urdu } from '../theme';
import { Text } from './ui';

function spanText(spans: MdSpan[]): string {
  return spans.map((s) => s.text).join('');
}

/**
 * One block of text. React Native nests Text freely, so a mixed line of
 * bold and plain spans is one Text with children rather than a row of
 * views, which keeps the wrapping natural.
 */
function Block({
  spans,
  size = 14.5,
  color = C.ink,
  face = 'body',
}: {
  spans: MdSpan[];
  size?: number;
  color?: string;
  face?: 'body' | 'bodyBold' | 'display';
}) {
  const rtl = isUrduScript(spanText(spans));
  // An English block stays in the Latin faces in the Urdu interface too: in
  // Nastaliq, this Latin line height cut the descenders off (see F.latin).
  const base = rtl
    ? urdu(size)
    : {
        fontFamily: face === 'display' ? F.latin.display : face === 'bodyBold' ? F.latin.bodyBold : F.latin.body,
        fontSize: size,
        lineHeight: Math.round(size * 1.55),
      };
  return (
    <Text style={[base, { color }]}>
      {spans.map((s, i) => (
        <Text
          key={i}
          style={
            s.bold
              ? { fontFamily: rtl ? F.urduBold : F.latin.bodyBold, color: C.ink }
              : s.italic
                ? { fontStyle: 'italic' }
                : s.code
                  ? { fontFamily: 'monospace', fontSize: size - 1, color: C.tealDark }
                  : undefined
          }
        >
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

export function Markdown({
  text,
  size = 14.5,
  color = C.ink,
}: {
  text: string;
  size?: number;
  color?: string;
}) {
  const blocks = parseMarkdown(text);
  return (
    <View style={{ gap: 10 }}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading':
            return (
              <Block
                key={i}
                spans={b.spans}
                size={b.level === 1 ? size + 2.5 : size - 0.5}
                color={b.level === 2 ? C.teal : C.ink}
                face={b.level === 1 ? 'display' : 'bodyBold'}
              />
            );
          case 'bullets':
            return (
              <View key={i} style={{ gap: 6 }}>
                {b.items.map((item, j) => {
                  const rtl = isUrduScript(spanText(item));
                  return (
                    <View
                      key={j}
                      style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 8 }}
                    >
                      <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: C.teal, marginTop: 8 }} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Block spans={item} size={size} color={color} />
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          case 'numbers':
            return (
              <View key={i} style={{ gap: 6 }}>
                {b.items.map((item, j) => {
                  const rtl = isUrduScript(spanText(item));
                  return (
                    <View
                      key={j}
                      style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 8 }}
                    >
                      {/* In the face of the line it numbers, so it sits on
                          the same baseline. */}
                      <Text
                        style={{
                          fontFamily: rtl ? F.bodyBold : F.latin.bodyBold,
                          fontSize: size - 1.5,
                          color: C.teal,
                          marginTop: 2,
                        }}
                      >
                        {b.start + j}.
                      </Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Block spans={item} size={size} color={color} />
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          case 'quote':
            return (
              <View
                key={i}
                style={
                  isUrduScript(spanText(b.spans))
                    ? { borderRightWidth: 3, borderRightColor: C.tealTint2, paddingRight: 10 }
                    : { borderLeftWidth: 3, borderLeftColor: C.tealTint2, paddingLeft: 10 }
                }
              >
                <Block spans={b.spans} size={size} color={C.ink2} />
              </View>
            );
          case 'code':
            return (
              <View key={i} style={{ backgroundColor: C.grey, borderRadius: 10, padding: 10 }}>
                <Text style={{ fontFamily: 'monospace', fontSize: size - 2, color: C.ink }}>{b.text}</Text>
              </View>
            );
          default:
            return <Block key={i} spans={b.spans} size={size} color={color} />;
        }
      })}
    </View>
  );
}
