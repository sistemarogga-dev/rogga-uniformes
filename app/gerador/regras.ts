// Textos padrão enviados à IA (o designer pode editar os dois em Configurações).

// Regras de EDIÇÃO: usadas ao editar uma arte. As informações que mudam a cada arte —
// cores medidas, quadros que podem mudar, papel de cada imagem — o servidor acrescenta
// sozinho (app/api/gerar).
export const REGRAS_EDICAO_PADRAO = `MODO EDIÇÃO — a arte final deve ser IDÊNTICA à arte atual, mudando SOMENTE o que o designer pediu.

MANTER IDÊNTICO (a menos que o pedido diga o contrário):
✅ Logomarcas: mesmo desenho, letras, cores, proporções e posições. Copie a logo do arquivo original enviado — nunca redesenhe, simplifique, traduza ou troque.
✅ Cores de todos os produtos (use os códigos de cor medidos na arte atual).
✅ Textos aplicados: telefones, nomes, sites e marcas nas mangas.
✅ Modelos dos produtos: corte, gola, mangas, botões, formato da bag e do windbanner.
✅ Fundos (imagens de contexto), posições e enquadramentos.

REGRAS:
1. Se o pedido não fala de cor, não mude nenhuma cor.
2. Se o pedido não fala de logo, não mude nenhuma logo.
3. Não acrescente nem remova nada que não foi pedido.
4. Cada produto fica inteiro dentro do seu quadro, com folga das bordas, sem zoom e sem um produto sobrepor o outro.`;

// Regras rígidas: usadas ao CRIAR uma arte nova.
export const REGRAS_PADRAO = `Use a PRIMEIRA imagem (arte de referência da Rogga) como base. Ela é um TEMPLATE FIXO e o resultado deve ser IDÊNTICO a ela.

O QUE PODE MUDAR (SOMENTE ISSO):
✅ Os produtos: polo piquet (frente e costas), camiseta (frente e costas), bag de cordão e windbanner — cores e aplicação da logomarca do cliente
✅ As imagens de contexto (fundo fotográfico) atrás dos produtos, dentro de cada quadro

O QUE NÃO PODE MUDAR:
❌ Cabeçalho (ROGGA Uniformes, "PROPOSTA DE UNIFORMES" e o subtítulo)
❌ Etiquetas dos quadros (POLO PIQUET, CAMISETA, WINDBANNER, BAGA PERSONALIZADA) e seus ícones
❌ Bordas douradas, molduras, cantos arredondados e espaçamentos
❌ Posição e tamanho dos 4 quadros
❌ Rodapé (site, Instagram e "Atendimento para todo o Brasil")
❌ Tipo, posição, tamanho, ângulo e enquadramento de cada produto

REGRAS:
1. Substituir cada "LOGO AQUI" pela logomarca enviada:
- Polo e camiseta: peito esquerdo na frente e centralizada nas costas
- Bag e windbanner: centralizada
Retire o fundo dos logotipos anexados.

2. Cores dos produtos escolhidas pela logomarca, pelo segmento e pela identidade visual do cliente. A polo e a camiseta devem ter cores diferentes entre si para gerar contraste.

3. Polo: apenas 2 botões, sem listras e sem estampas na gola, carcela da mesma cor do tronco.

4. Fundo de cada quadro: cenário fotográfico ligado ao ramo do cliente (ex: oficina → oficina premium; clínica → ambiente médico sofisticado; academia → academia premium; restaurante → cozinha gourmet; construção → obra moderna; transporte → centro logístico), com profundidade, desfoque natural, iluminação cinematográfica e aspecto premium. O fundo cobre 100% do quadro.

5. Os produtos ficam totalmente nítidos em primeiro plano e os logotipos perfeitamente legíveis.

6. Não criar nem remover áreas gráficas. O resultado deve parecer a arte de referência com apenas os produtos e os fundos trocados.`;
