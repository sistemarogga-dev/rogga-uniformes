// Textos padrão enviados à IA (o designer pode editar os dois em Configurações).
// Ficam em INGLÊS: a IA entende igual e o texto em inglês gasta menos tokens (menos custo).

// Regras de EDIÇÃO: usadas ao editar uma arte. As informações que mudam a cada arte —
// cores medidas, quadros que podem mudar, papel de cada imagem — o servidor acrescenta
// sozinho (app/api/gerar).
export const REGRAS_EDICAO_PADRAO = `EDIT MODE: the result must be IDENTICAL to the current art, changing ONLY what the request asks.
Keep unless the request says otherwise:
- Logos: same design, letters, colors, size and position. Copy them from the original logo files; never redraw, simplify, translate or swap.
- Product colors (use the measured hex codes).
- Applied texts: phones, names, websites, sleeve marks.
- Product models: cut, collar, sleeves, buttons, bag and windbanner shape.
- Backgrounds, positions and framing.
Do not add or remove anything that was not requested.`;

// Regras rígidas: usadas ao CRIAR uma arte nova.
export const REGRAS_PADRAO = `Image 1 is the fixed Rogga template. Keep it IDENTICAL: gold borders, frames, rounded corners, panel labels and icons, panel positions and sizes, and each product's type, model, position, size, angle and framing.
Change ONLY:
- Product colors and the client's logo, replacing every "LOGO AQUI": polo and t-shirt = small logo on the left chest (wearer's left, where "LOGO AQUI" is) and a large centered logo on the back; bag and windbanner = centered logo. Remove the logo's background.
- The photo background inside each panel.
Rules:
1. Colors from the client's logo, industry and brand. Polo and t-shirt in different colors for contrast; front and back of the same garment always the same color.
2. Polo: only 2 buttons, plain collar (no stripes or prints), placket the same color as the body.
3. Keep the product details, only recolored: windbanner diagonal stripes, shirt hem tag, bag drawstrings.
4. Background: premium photo of the client's industry (e.g. workshop, clinic, gym, kitchen, construction site, logistics center), depth of field, natural blur, cinematic light, covering 100% of each panel. Products sharp in front; logos perfectly legible.`;
