/**
 * The word اردو in the site's Nastaliq, as a drawing.
 *
 * It is the only Urdu on the landing page, in the hero badge, and set as text
 * it made every visitor download the whole Nastaliq face (about 236KB) for
 * four letters. This is those four glyphs, shaped by HarfBuzz from the same
 * font file (app/fonts/nastaliq.woff2) and written out as one path: about
 * 1.4KB, the same letterforms, in the colour of the text around it. Sized and
 * nudged like `.urdu-inline` (1.22em, sitting slightly low), so it lines up
 * with the Latin beside it the way the text did.
 *
 * Server-safe and decorative only as far as its shape: it carries its name
 * for a screen reader.
 */
export function UrduWord({ className = '' }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="Urdu"
      viewBox="20 -869 1341 937"
      fill="currentColor"
      className={`inline-block ${className}`}
      style={{ height: '1.14em', width: '1.63em', verticalAlign: '-0.2em' }}
    >
      <path d="M24 68L20 46Q63 20 102 -7Q140 -34 173 -60Q227 -104 260 -141Q292 -179 292 -201Q292 -204 292 -206Q292 -208 290 -209Q273 -197 257 -191Q240 -186 223 -186Q200 -186 180 -196Q160 -206 148 -223Q136 -241 136 -262Q136 -279 141 -297Q146 -316 156 -336L189 -402Q213 -449 257 -449Q286 -449 306 -430Q325 -412 335 -375Q345 -338 345 -282Q345 -254 341 -221Q336 -189 325 -154Q314 -119 296 -85Q278 -51 252 -20Q241 -13 217 -1Q192 10 160 23Q128 35 93 47Q57 59 24 68ZM379 67L377 45Q402 32 435 13Q467 -6 501 -29Q535 -52 564 -75Q592 -98 610 -119Q628 -140 628 -156Q628 -171 615 -193Q601 -215 571 -240Q541 -266 490 -289Q494 -302 505 -325Q515 -348 528 -374Q541 -401 554 -424Q566 -447 575 -459L586 -459Q614 -442 640 -415Q665 -388 682 -351Q698 -314 698 -266Q698 -229 688 -187Q678 -145 660 -105Q641 -66 618 -36Q594 -6 567 8Q542 21 495 36Q447 50 379 67ZM679 37L675 14Q700 0 731 -22Q762 -44 794 -70Q826 -96 856 -122Q886 -148 909 -171Q932 -194 945 -209Q957 -223 970 -245Q982 -268 995 -296Q1008 -325 1021 -357Q1033 -389 1045 -421L1075 -416Q1056 -337 1035 -273Q1013 -209 991 -160Q968 -112 945 -78Q922 -45 900 -28Q889 -22 874 -16Q858 -10 839 -4Q819 2 795 9Q770 15 741 22Q712 29 679 37ZM1251 -101L1229 -106Q1234 -129 1239 -179Q1244 -229 1247 -301L1256 -540Q1258 -585 1261 -619Q1263 -653 1271 -686Q1279 -720 1296 -763Q1312 -806 1340 -869L1361 -861Q1353 -841 1348 -790Q1342 -740 1337 -659L1320 -377Q1316 -313 1300 -244Q1283 -175 1251 -101Z" />
    </svg>
  );
}
