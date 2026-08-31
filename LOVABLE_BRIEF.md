# Briefing Lovable — Currículo / Portfólio Ricardo Rodrigues

## Objetivo
Transformar o modelo existente em `curriculo-modelo/` em um portfólio profissional moderno, responsivo e visualmente refinado, trabalhando somente no branch `curriculo-site-base`.

## Regra principal
Use os arquivos em `curriculo-modelo/` como fonte de verdade para conteúdo, hierarquia e informações profissionais. Não invente experiências, cursos, publicações, datas, contatos ou competências.

## Escopo — faça tudo em uma única implementação
- Criar/reconstruir a interface principal como um currículo/portfólio de página única.
- Priorizar UI/UX, hierarquia visual, legibilidade, responsividade e microinterações leves.
- Visual: tecnologia/engenharia, dark grafite/preto, azul discreto, aparência premium e técnica.
- Tipografia: Space Grotesk para títulos e IBM Plex Sans para textos, ou equivalentes já disponíveis no projeto.
- Seções: Hero, Sobre, Competências, Experiência Profissional, Formação Acadêmica, Cursos/Badges, Publicações/Projetos e Contato.
- Navegação sticky com scroll suave e estado mobile elegante.
- Cards e timeline com bom contraste, espaçamento e leitura em desktop e celular.
- Incluir CTAs para Experiência e Contato.
- Manter Mogi das Cruzes-SP; não expor endereço residencial completo, CEP ou idade.
- Manter os links de publicações e Google Cloud já existentes no modelo.
- Preparar SEO básico: title, description, headings semânticos e Open Graph simples sem gerar imagens.
- Acessibilidade: foco visível, contraste adequado, labels/aria quando necessários e navegação por teclado.

## Restrições para economizar créditos e evitar retrabalho
- Não criar backend, autenticação, banco de dados, Supabase, funções serverless ou painel administrativo.
- Não gerar imagens por IA.
- Não instalar bibliotecas novas se o stack atual já resolver o problema.
- Reutilizar componentes, Tailwind/CSS e dependências existentes sempre que possível.
- Não criar funcionalidades que não foram solicitadas.
- Não alterar o conteúdo profissional além de pequenos ajustes de redação/ortografia que não mudem o significado.
- Não faça perguntas intermediárias: tome decisões de UI/UX dentro deste briefing e entregue a versão completa em uma única rodada.
- Antes de finalizar, valide desktop e mobile e corrija overflow, contraste e espaçamento na mesma execução.

## Resultado esperado
Um portfólio de currículo de alta qualidade, limpo e profissional, com estética de engenharia/tecnologia, pronto para publicação e fácil de manter pelo GitHub.
