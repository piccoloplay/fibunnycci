// ═══════════════════════════════════════════════════════════════
// UI MODULE — Centralized rendering helpers for modern mobile UI
// Style: Yo-kai Watch / Ni no Kuni / Inazuma Eleven
// ═══════════════════════════════════════════════════════════════
const UI = {
    // Font family (loaded from Google Fonts, fallback to sans-serif)
    FONT: 'Nunito, Fredoka, sans-serif',

    // ─── COLOR PALETTE ───
    colors: {
        // Primary
        blue:       '#4488ff',
        blueLight:  '#66aaff',
        blueDark:   '#2266cc',
        // Accent
        yellow:     '#ffcc00',
        yellowLight:'#ffdd44',
        yellowDark: '#ddaa00',
        orange:     '#ff8833',
        // Positive/Negative
        green:      '#44cc66',
        greenDark:  '#22aa44',
        red:        '#ff4455',
        redDark:    '#cc2233',
        pink:       '#ff6688',
        // Neutral
        white:      '#ffffff',
        light:      '#f0f0f5',
        gray:       '#aaaabb',
        grayDark:   '#666677',
        dark:       '#333344',
        darker:     '#1a1a2e',
        // UI specific
        cardBg:     '#f8f6f0',
        cardBorder: '#ddd8cc',
        panelBg:    'rgba(240,238,230,0.96)',
        panelBgDark:'rgba(20,20,40,0.95)',
        shadow:     'rgba(0,0,0,0.15)',
        // Element colors
        fuoco:      '#ff4422',
        acqua:      '#3388ff',
        terra:      '#aa8844',
        legno:      '#44aa44',
        metallo:    '#aaaacc'
    },

    // ─── FONT HELPERS ───
    font(size, weight) {
        weight = weight || 'normal';
        return `${weight} ${size}px ${this.FONT}`;
    },

    fontBold(size) {
        return `bold ${size}px ${this.FONT}`;
    },

    // ─── DRAW: ROUNDED RECT ───
    roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    },

    // ─── DRAW: GRADIENT BUTTON ───
    // Draws a beautiful gradient button with shadow, highlight, and text
    drawButton(ctx, x, y, w, h, text, opts) {
        opts = opts || {};
        // Guard against NaN
        if (!isFinite(x) || !isFinite(y) || !isFinite(w) || !isFinite(h) || h <= 0 || w <= 0) return;

        const r = opts.radius || 12;
        const color1 = opts.color1 || this.colors.blue;
        const color2 = opts.color2 || this.colors.blueDark;
        const textColor = opts.textColor || '#fff';
        const fontSize = opts.fontSize || 14;
        const selected = opts.selected || false;
        const icon = opts.icon || null;

        ctx.save();

        // Shadow
        if (!opts.noShadow) {
            ctx.fillStyle = this.colors.shadow;
            this.roundRect(ctx, x + 2, y + 3, w, h, r);
            ctx.fill();
        }

        // Main gradient
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        if (selected) {
            grad.addColorStop(0, opts.selectedColor1 || this.colors.yellowLight);
            grad.addColorStop(1, opts.selectedColor2 || this.colors.yellow);
        } else {
            grad.addColorStop(0, color1);
            grad.addColorStop(0.5, color2);
            grad.addColorStop(1, color1);
        }
        ctx.fillStyle = grad;
        this.roundRect(ctx, x, y, w, h, r);
        ctx.fill();

        // Top highlight (inner glow)
        const hlGrad = ctx.createLinearGradient(x, y, x, y + h * 0.5);
        hlGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
        hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hlGrad;
        this.roundRect(ctx, x + 2, y + 1, w - 4, h * 0.5, r - 1);
        ctx.fill();

        // Border
        ctx.strokeStyle = selected ? '#fff' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = selected ? 2 : 1;
        this.roundRect(ctx, x, y, w, h, r);
        ctx.stroke();

        // Text with shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.font = this.fontBold(fontSize);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textX = icon ? x + w / 2 + 8 : x + w / 2;
        const textY = y + h / 2;

        // Text shadow
        ctx.fillText(text, textX + 1, textY + 1);
        // Text
        ctx.fillStyle = selected ? this.colors.dark : textColor;
        ctx.fillText(text, textX, textY);

        // Icon (left of text)
        if (icon) {
            ctx.font = `${fontSize + 4}px ${this.FONT}`;
            ctx.fillText(icon, x + w / 2 - ctx.measureText(text).width / 2 - 14, textY);
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
    },

    // ─── DRAW: CARD ───
    drawCard(ctx, x, y, w, h, opts) {
        opts = opts || {};
        const r = opts.radius || 10;
        const selected = opts.selected || false;
        const borderColor = opts.borderColor || this.colors.cardBorder;

        ctx.save();

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        this.roundRect(ctx, x + 2, y + 3, w, h, r);
        ctx.fill();

        // Background
        ctx.fillStyle = opts.bgColor || (selected ? '#fff' : this.colors.cardBg);
        this.roundRect(ctx, x, y, w, h, r);
        ctx.fill();

        // Border
        ctx.strokeStyle = selected ? this.colors.yellow : borderColor;
        ctx.lineWidth = selected ? 2.5 : 1;
        this.roundRect(ctx, x, y, w, h, r);
        ctx.stroke();

        // Selected glow
        if (selected) {
            ctx.shadowColor = this.colors.yellow;
            ctx.shadowBlur = 8;
            ctx.strokeStyle = this.colors.yellow;
            this.roundRect(ctx, x, y, w, h, r);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    },

    // ─── DRAW: HP BAR ───
    drawHPBar(ctx, x, y, w, h, ratio, opts) {
        opts = opts || {};
        const r = h / 2;
        const borderColor = opts.borderColor || '#555';

        // Background track
        ctx.fillStyle = '#2a2a3a';
        this.roundRect(ctx, x, y, w, h, r);
        ctx.fill();

        // Fill
        if (ratio > 0) {
            const fillW = Math.max(h, w * ratio);
            const grad = ctx.createLinearGradient(x, y, x, y + h);
            if (ratio > 0.5) {
                grad.addColorStop(0, '#66ee88');
                grad.addColorStop(1, '#33bb55');
            } else if (ratio > 0.2) {
                grad.addColorStop(0, '#ffcc44');
                grad.addColorStop(1, '#ee9922');
            } else {
                grad.addColorStop(0, '#ff6655');
                grad.addColorStop(1, '#cc3322');
            }
            ctx.fillStyle = grad;
            this.roundRect(ctx, x, y, fillW, h, r);
            ctx.fill();

            // Shine on HP bar
            const shineGrad = ctx.createLinearGradient(x, y, x, y + h * 0.4);
            shineGrad.addColorStop(0, 'rgba(255,255,255,0.3)');
            shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = shineGrad;
            this.roundRect(ctx, x + 1, y, fillW - 2, h * 0.5, r);
            ctx.fill();
        }

        // Border
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1.5;
        this.roundRect(ctx, x, y, w, h, r);
        ctx.stroke();
    },

    // ─── DRAW: TEXT WITH OUTLINE (for combat/game text) ───
    textOutline(ctx, text, x, y, opts) {
        opts = opts || {};
        const color = opts.color || '#fff';
        const size = opts.size || 14;
        const bold = opts.bold ? 'bold ' : '';
        const align = opts.align || 'left';
        const outlineColor = opts.outlineColor || '#000';
        const outlineWidth = opts.outlineWidth || Math.max(3, size * 0.15);

        ctx.font = `${bold}${size}px ${this.FONT}`;
        ctx.textAlign = align;
        ctx.textBaseline = opts.baseline || 'alphabetic';

        // Outline
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = outlineWidth;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x, y);

        // Fill
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    },

    // ─── DRAW: TEXT WITH SHADOW ───
    text(ctx, text, x, y, opts) {
        opts = opts || {};
        const color = opts.color || '#333';
        const size = opts.size || 14;
        const bold = opts.bold ? 'bold ' : '';
        const align = opts.align || 'left';
        const shadowColor = opts.shadowColor || 'rgba(0,0,0,0.2)';

        ctx.font = `${bold}${size}px ${this.FONT}`;
        ctx.textAlign = align;
        ctx.textBaseline = opts.baseline || 'alphabetic';

        // Shadow
        if (!opts.noShadow) {
            ctx.fillStyle = shadowColor;
            ctx.fillText(text, x + 1, y + 1);
        }

        // Text
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    },

    // ─── DRAW: PANEL BACKGROUND (gradient + pattern) ───
    drawPanelBg(ctx, w, h, opts) {
        opts = opts || {};
        if (!isFinite(w) || !isFinite(h) || h <= 0) return;
        const dark = opts.dark !== false;

        if (dark) {
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#1a1a3a');
            grad.addColorStop(0.5, '#0f0f2a');
            grad.addColorStop(1, '#1a1a3a');
            ctx.fillStyle = grad;
        } else {
            // Light mode (like Yo-kai Watch)
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#e8f4ff');
            grad.addColorStop(0.5, '#d0e8ff');
            grad.addColorStop(1, '#e8f4ff');
            ctx.fillStyle = grad;
        }
        ctx.fillRect(0, 0, w, h);

        // Subtle dot pattern
        ctx.fillStyle = dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,100,0.03)';
        for (let py = 0; py < h; py += 12) {
            for (let px = (py % 24 === 0 ? 0 : 6); px < w; px += 12) {
                ctx.beginPath();
                ctx.arc(px, py, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },

    // ─── DRAW: ICON (simple shapes, not emoji) ───
    drawIcon(ctx, x, y, name, size) {
        const s = size || 16;
        ctx.save();
        ctx.translate(x, y);

        switch (name) {
            case 'team':
                // 3 circles (people)
                ctx.fillStyle = this.colors.blue;
                ctx.beginPath(); ctx.arc(-s * 0.3, 0, s * 0.28, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(s * 0.3, 0, s * 0.28, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = this.colors.blueLight;
                ctx.beginPath(); ctx.arc(0, -s * 0.15, s * 0.32, 0, Math.PI * 2); ctx.fill();
                break;
            case 'home':
                // House: roof triangle + body square + door
                ctx.fillStyle = this.colors.red;
                ctx.beginPath();
                ctx.moveTo(-s * 0.5, -s * 0.05);
                ctx.lineTo(0, -s * 0.5);
                ctx.lineTo(s * 0.5, -s * 0.05);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = this.colors.orange;
                this.roundRect(ctx, -s * 0.38, -s * 0.08, s * 0.76, s * 0.5, 2);
                ctx.fill();
                ctx.fillStyle = '#3a2415';
                this.roundRect(ctx, -s * 0.1, s * 0.1, s * 0.2, s * 0.32, 2);
                ctx.fill();
                break;
            case 'bestiary':
                // Book
                ctx.fillStyle = this.colors.orange;
                this.roundRect(ctx, -s * 0.4, -s * 0.45, s * 0.8, s * 0.9, 3);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.fillRect(-s * 0.25, -s * 0.3, s * 0.5, 2);
                ctx.fillRect(-s * 0.25, -s * 0.15, s * 0.35, 2);
                ctx.fillRect(-s * 0.25, 0, s * 0.45, 2);
                break;
            case 'inventory':
                // Bag
                ctx.fillStyle = this.colors.green;
                this.roundRect(ctx, -s * 0.35, -s * 0.15, s * 0.7, s * 0.6, 5);
                ctx.fill();
                ctx.strokeStyle = this.colors.greenDark;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, -s * 0.15, s * 0.25, Math.PI, 0);
                ctx.stroke();
                break;
            case 'map':
                // Pin on map
                ctx.fillStyle = this.colors.red;
                ctx.beginPath();
                ctx.arc(0, -s * 0.15, s * 0.25, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(-s * 0.15, s * 0.05);
                ctx.lineTo(0, s * 0.45);
                ctx.lineTo(s * 0.15, s * 0.05);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(0, -s * 0.15, s * 0.1, 0, Math.PI * 2); ctx.fill();
                break;
            case 'save':
                // Floppy / SD card
                ctx.fillStyle = this.colors.blue;
                this.roundRect(ctx, -s * 0.35, -s * 0.4, s * 0.7, s * 0.8, 3);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.fillRect(-s * 0.2, -s * 0.4, s * 0.4, s * 0.3);
                ctx.fillStyle = this.colors.blueDark;
                ctx.fillRect(-s * 0.2, s * 0.05, s * 0.4, s * 0.25);
                break;
            case 'settings':
                // Gear
                ctx.strokeStyle = this.colors.gray;
                ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2); ctx.stroke();
                for (let a = 0; a < 6; a++) {
                    const angle = a * Math.PI / 3;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(angle) * s * 0.2, Math.sin(angle) * s * 0.2);
                    ctx.lineTo(Math.cos(angle) * s * 0.4, Math.sin(angle) * s * 0.4);
                    ctx.stroke();
                }
                break;
            case 'close':
                // X
                ctx.strokeStyle = this.colors.red;
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(-s * 0.25, -s * 0.25); ctx.lineTo(s * 0.25, s * 0.25); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(s * 0.25, -s * 0.25); ctx.lineTo(-s * 0.25, s * 0.25); ctx.stroke();
                break;
            case 'menu':
                // Home/hamburger
                ctx.fillStyle = '#fff';
                // House shape
                ctx.beginPath();
                ctx.moveTo(0, -s * 0.4);
                ctx.lineTo(-s * 0.35, -s * 0.05);
                ctx.lineTo(-s * 0.25, -s * 0.05);
                ctx.lineTo(-s * 0.25, s * 0.3);
                ctx.lineTo(s * 0.25, s * 0.3);
                ctx.lineTo(s * 0.25, -s * 0.05);
                ctx.lineTo(s * 0.35, -s * 0.05);
                ctx.closePath();
                ctx.fill();
                // Door
                ctx.fillStyle = this.colors.blue;
                ctx.fillRect(-s * 0.08, s * 0.08, s * 0.16, s * 0.22);
                break;
        }

        ctx.restore();
    },

    // ─── DRAW: WORD-WRAPPED TEXT ───
    wrapText(ctx, text, x, y, maxW, lineH) {
        const words = text.split(' ');
        let line = '';
        let cy = y;
        for (const word of words) {
            const test = line + word + ' ';
            if (ctx.measureText(test).width > maxW && line.length > 0) {
                ctx.fillText(line.trim(), x, cy);
                line = word + ' ';
                cy += lineH;
            } else {
                line = test;
            }
        }
        if (line.trim()) ctx.fillText(line.trim(), x, cy);
        return cy; // Return final Y for chaining
    },

    // ─── EASING FUNCTIONS ───
    easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    },

    easeOutQuad(t) {
        return 1 - (1 - t) * (1 - t);
    }
};
