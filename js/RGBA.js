/*@preserve Copyright (C) 2017-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("js/RGBA", function() {

    /**
     * Class to represent an RGBA colour, and convert to/from other
     * representations
     */

    /* Table of HTMl colour names and their RGB values */
    const CSSColours = {
        aliceblue: "#F0F8FF",
        antiquewhite: "#FAEBD7",
        aqua: "#00FFFF",
        aquamarine: "#7FFFD4",
        azure: "#F0FFFF",
        beige: "#F5F5DC",
        bisque: "#FFE4C4",
        black: "#000000",
        blanchedalmond: "#FFEBCD",
        blue: "#0000FF",
        blueviolet: "#8A2BE2",
        brown: "#A52A2A",
        burlywood: "#DEB887",
        cadetblue: "#5F9EA0",
        chartreuse: "#7FFF00",
        chocolate: "#D2691E",
        coral: "#FF7F50",
        cornflowerblue: "#6495ED",
        cornsilk: "#FFF8DC",
        crimson: "#DC143C",
        cyan: "#00FFFF",
        darkblue: "#00008B",
        darkcyan: "#008B8B",
        darkgoldenrod: "#B8860B",
        darkgray: "#A9A9A9",
        darkgrey: "#A9A9A9",
        darkgreen: "#006400",
        darkkhaki: "#BDB76B",
        darkmagenta: "#8B008B",
        darkolivegreen: "#556B2F",
        darkorange: "#FF8C00",
        darkorchid: "#9932CC",
        darkred: "#8B0000",
        darksalmon: "#E9967A",
        darkseagreen: "#8FBC8F",
        darkslateblue: "#483D8B",
        darkslategray: "#2F4F4F",
        darkslategrey: "#2F4F4F",
        darkturquoise: "#00CED1",
        darkviolet: "#9400D3",
        deeppink: "#FF1493",
        deepskyblue: "#00BFFF",
        dimgray: "#696969",
        dimgrey: "#696969",
        dodgerblue: "#1E90FF",
        firebrick: "#B22222",
        floralwhite: "#FFFAF0",
        forestgreen: "#228B22",
        fuchsia: "#FF00FF",
        gainsboro: "#DCDCDC",
        ghostwhite: "#F8F8FF",
        gold: "#FFD700",
        goldenrod: "#DAA520",
        gray: "#808080",
        grey: "#808080",
        green: "#008000",
        greenyellow: "#ADFF2F",
        honeydew: "#F0FFF0",
        hotpink: "#FF69B4",
        indianred: "#CD5C5C",
        indigo: "#4B0082",
        ivory: "#FFFFF0",
        khaki: "#F0E68C",
        lavender: "#E6E6FA",
        lavenderblush: "#FFF0F5",
        lawngreen: "#7CFC00",
        lemonchiffon: "#FFFACD",
        lightblue: "#ADD8E6",
        lightcoral: "#F08080",
        lightcyan: "#E0FFFF",
        lightgoldenrodyellow: "#FAFAD2",
        lightgray: "#D3D3D3",
        lightgrey: "#D3D3D3",
        lightgreen: "#90EE90",
        lightpink: "#FFB6C1",
        lightsalmon: "#FFA07A",
        lightseagreen: "#20B2AA",
        lightskyblue: "#87CEFA",
        lightslategray: "#778899",
        lightslategrey: "#778899",
        lightsteelblue: "#B0C4DE",
        lightyellow: "#FFFFE0",
        lime: "#00FF00",
        limegreen: "#32CD32",
        linen: "#FAF0E6",
        magenta: "#FF00FF",
        maroon: "#800000",
        mediumaquamarine: "#66CDAA",
        mediumblue: "#0000CD",
        mediumorchid: "#BA55D3",
        mediumpurple: "#9370DB",
        mediumseagreen: "#3CB371",
        mediumslateblue: "#7B68EE",
        mediumspringgreen: "#00FA9A",
        mediumturquoise: "#48D1CC",
        mediumvioletred: "#C71585",
        midnightblue: "#191970",
        mintcream: "#F5FFFA",
        mistyrose: "#FFE4E1",
        moccasin: "#FFE4B5",
        navajowhite: "#FFDEAD",
        navy: "#000080",
        oldlace: "#FDF5E6",
        olive: "#808000",
        olivedrab: "#6B8E23",
        orange: "#FFA500",
        orangered: "#FF4500",
        orchid: "#DA70D6",
        palegoldenrod: "#EEE8AA",
        palegreen: "#98FB98",
        paleturquoise: "#AFEEEE",
        palevioletred: "#DB7093",
        papayawhip: "#FFEFD5",
        peachpuff: "#FFDAB9",
        peru: "#CD853F",
        pink: "#FFC0CB",
        plum: "#DDA0DD",
        powderblue: "#B0E0E6",
        purple: "#800080",
        rebeccapurple: "#663399",
        red: "#FF0000",
        rosybrown: "#BC8F8F",
        royalblue: "#4169E1",
        saddlebrown: "#8B4513",
        salmon: "#FA8072",
        sandybrown: "#F4A460",
        seagreen: "#2E8B57",
        seashell: "#FFF5EE",
        sienna: "#A0522D",
        silver: "#C0C0C0",
        skyblue: "#87CEEB",
        slateblue: "#6A5ACD",
        slategray: "#708090",
        slategrey: "#708090",
        snow: "#FFFAFA",
        springgreen: "#00FF7F",
        steelblue: "#4682B4",
        tan: "#D2B48C",
        teal: "#008080",
        thistle: "#D8BFD8",
        tomato: "#FF6347",
        turquoise: "#40E0D0",
        violet: "#EE82EE",
        wheat: "#F5DEB3",
        white: "#FFFFFF",
        whitesmoke: "#F5F5F5",
        yellow: "#FFFF00",
        yellowgreen: "#9ACD32"
    };

    /**
     * Parse a colour string (colour name, #, rgb, rgba, hsl or hsla value)
     * to an RGBA tuple.
     * @param r a number (requires g and b if it is) or a CSS colour string
     * @param g a number (if r is defined and is a number)
     * @param b a number (if r is defined and is a number)
     * @param a a number (if r is defined and is a number)
     */
    class RGBA {
        constructor(r, g, b, a) {
            function parseComponent(value, max) {
                if (/%\s*$/.test(value)) {
                    let pc = parseFloat(value);
                    return pc * max / 100.0;
                }
                return parseFloat(value);
            }

            if (arguments.length === 1) {
                if (typeof r !== "string") {
                    if (r.constructor.name === "Array") {
                        this.r = r[0];
                        this.g = r[1];
                        this.b = r[2];
                        this.a = r[3];
                    } else if (typeof r.r === "number" &&
                               typeof r.g === "number" &&
                               typeof r.b === "number") {
                        this.r = r.r;
                        this.g = r.g;
                        this.b = r.b;
                        this.a = r.a;
                    } else
                        throw "Don't know how to make an RGBA from this";
                    return;
                }
            } else {
                this.r = r;
                this.g = g;
                this.b = b;
                this.a = a;
                return;
            }

            // String or integer RGB value
            if (typeof r === "string") {
                let named = CSSColours[r.toLowerCase()];
                if (typeof named !== "undefined")
                    r = named;

                if (r.charAt(0) == "#") {
                    this.r = parseInt(r.substr(1, 2), 16) / 255.0;
                    this.g = parseInt(r.substr(3, 2), 16) / 255.0;
                    this.b = parseInt(r.substr(5, 2), 16) / 255.0;
                    return;
                }

                if (/^hsla?\(.*\)$/.test(r)) {
                    a = r.replace(/(hsla?\(|\))/g, "")
                        .split(/[,\s]+/);
                    let n = RGBA.fromHSL(
                        parseComponent(a[0], 360),
                        parseComponent(a[1], 1),
                        parseComponent(a[2], 1),
                        a.length > 3 ? parseComponent(a[3], 1) : undefined
                    );
                    this.r = n.r;
                    this.g = n.g;
                    this.b = n.b;
                    this.a = n.a;
                    return;
                }

                if (/^rgba?\(.*\)$/.test(r)) {
                    a = r.replace(/(rgba?\(|\))/g, "")
                        .split(",");
                    this.r = Math.floor(parseComponent(a[0], 255)) / 255;
                    this.g = Math.floor(parseComponent(a[1], 255)) / 255;
                    this.b = Math.floor(parseComponent(a[2], 255)) / 255;
                    if (a.length > 3) this.a = parseComponent(a[3], 1);
                    return;
                }
            }

            if (typeof r === "object" && r.constructor.name === "RGBA")
                jQuery.extend(this, r);

            throw `Cannot construct from ${typeof r}`;
        }

        /**
         * Crude RGB inversion - simply invert the colour components
         */
        inverse() {
            return new RGBA(1 - this.r, 1 - this.g, 1 - this.b, this.a);
        }

        /**
         * More sophisticated HSV complement
         */
        complement() {
            let hsv = this.toHSV();
            return RGBA.fromHSV((hsv[0] + 180) % 360, hsv[1], hsv[2], this.a);
        }

        /**
         * Find the approximate brightness of an RGBA colour in the range 0..1
         * Anything above 0.65 is closer to white, below that to black
         * @see https://en.wikipedia.org/wiki/HSL_and_HSV
         */
        luma() {
            // SMPTE C, Rec. 709 weightings
            return (0.2126 * this.r) + (0.7152 * this.g) + (0.0722 * this.b);
        }

        /**
         * Generate a CSS string for the colour. CSS colour string is
         * used if there is no A, a css rgba() otherwise.
         */
        toString() {
            let tuple = [Math.round(255 * this.r),
                         Math.round(255 * this.g),
                         Math.round(255 * this.b)];

            if (typeof this.a !== "undefined") {
                tuple.push(this.a);
                return `rgba(${tuple.join(",")})`;
            } else {
                let s = "#";
                for (let i = 0; i < 3; i++) {
                    let v = tuple[i].toString(16);
                    s += v.length == 1 ? `0${v}` : v;
                }
                return s.toUpperCase();
            }
        }

        /**
         * Generate an HSV[A] value as a [ H, S, V, A ]
         * e.g. let hsv = new RGBA("blue").toHSV()
         * @see https://en.wikipedia.org/wiki/HSL_and_HSV
         * @return [ hue (0..360), saturation (0..1), value (0..1) ]
         */
        toHSV() {
            let M = Math.max(this.r, this.g, this.b);
            let m = Math.min(this.r, this.g, this.b);
            let C = M - m; // saturation / chroma
            let V = M;
            let S = (V == 0) ? 0 : (C / V); // sat (= chroma)
            let H = 0;

            if (C != 0) {
                // not achromatic, calculate hue
                if (this.r === M)
                    H = 60 * (((this.g - this.b) / C) % 6);
                else if (this.g === M)
                    H = 60 * ((this.b - this.r) / C + 2);
                else
                    H = 60 * ((this.r - this.g) / C + 4);

                if (H < 0)
                    H += 360;
            }

            let hsv = [H, S, V];

            if (typeof this.a != "undefined")
                hsv.push(this.a);

            return hsv;
        }

        /**
         * Generate an HSL[A] value as a [ H, S, L, A ]
         * e.g. let hsl = new RGBA("blue").toHSL()
         * @see https://en.wikipedia.org/wiki/HSL_and_HSV
         * @return [ hue (0..360), saturation (0..1), lightness (0..1) ]
         */
        toHSL() {
            let M = Math.max(this.r, this.g, this.b);
            let m = Math.min(this.r, this.g, this.b);
            let C = M - m; // saturation / chroma
            let H, S, L;

            if (C == 0) { // achromatic
                H = S = 0;
                L = M;
            } else {
                L = (M + m) / 2;
                S = C / (L > 0.5 ? (2 - M - m) : (M + m));
            }

            if (C != 0) {
                // not achromatic, calculate hue
                if (this.r === M)
                    H = 60 * (((this.g - this.b) / C) % 6);
                else if (this.g === M)
                    H = 60 * ((this.b - this.r) / C + 2);
                else
                    H = 60 * ((this.r - this.g) / C + 4);

                if (H < 0)
                    H += 360;
            }

            let hsl = [H, S, L];

            if (typeof this.a != "undefined")
                hsl.push(this.a);

            return hsl;
        }

        /**
         * Generate a new Colour from HSV[A]. H, S, V [, A] can be passed directly
         * or H will be assumed to be a tuple if S is undefined.
         */
        static fromHSV(H, S, V, A) {
            let R, G, B;

            if (arguments.length === 1) {
                A = H[3];
                V = H[2];
                S = H[1];
                H = H[0];
            }

            if (S == 0) {
                R = G = B = V; // achromatic

            } else {
                H /= 60;
                let i = Math.floor(H);
                let f = H - i;
                let p = V * (1 - S);
                let q = V * (1 - S * f);
                let t = V * (1 - S * (1 - f));
                switch (i) {
                case 0:
                    R = V;
                    G = t;
                    B = p;
                    break;
                case 1:
                    R = q;
                    G = V;
                    B = p;
                    break;
                case 2:
                    R = p;
                    G = V;
                    B = t;
                    break;
                case 3:
                    R = p;
                    G = q;
                    B = V;
                    break;
                case 4:
                    R = t;
                    G = p;
                    B = V;
                    break;
                default:
                    R = V;
                    G = p;
                    B = q;
                }
            }

            return new RGBA(R, G, B, A);
        }

        /**
         * Generate a new Colour from HSL. H, S, L [, A] can be passed directly
         * or H can be a tuple.
         */
        static fromHSL(H, S, L, A) {

            function hue2RGB(p, q, t) {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            }

            let R, G, B;

            if (arguments.length === 1) {
                A = H[3];
                L = H[2];
                S = H[1];
                H = H[0];
            }

            if (S == 0) {
                R = G = B = L; // achromatic

            } else {
                H /= 360;
                let q = L < 0.5 ? L * (1 + S) :
                    L + S - L * S;
                let p = 2 * L - q;
                R = hue2RGB(p, q, H + 1 / 3);
                G = hue2RGB(p, q, H);
                B = hue2RGB(p, q, H - 1 / 3);

            }

            return new RGBA(R, G, B, A);
        }
    }

    return RGBA;
});

