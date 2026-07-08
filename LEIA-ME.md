# Pulso — a tua app de saúde, treino e alimentação

## O que está incluído
- `index.html`, `style.css`, `app.js` — a app
- `manifest.json`, `sw.js`, `icons/` — o que torna a app instalável (PWA)

## Como pôr a app a funcionar (importante)

Um PWA **tem de ser servido via HTTPS** (ou `localhost`) para o service worker e a instalação funcionarem — não basta abrir o `index.html` a fazer duplo clique. Opções simples e grátis:

1. **GitHub Pages** — cria um repositório, faz upload destes ficheiros, ativa "Pages" nas definições. Fica com um link `https://oteunome.github.io/pulso/`.
2. **Netlify / Vercel** — arrasta a pasta para o site deles (drag & drop), sem precisares de conta em alguns casos.
3. **Cloudflare Pages** — semelhante ao Netlify.

Depois de teres o link em HTTPS:

### Instalar no Android
Abre o link no Chrome → menu (⋮) → **"Instalar aplicação"** / **"Adicionar ao ecrã principal"**.

### Instalar no iPhone/iPad
Abre o link no Safari → botão **Partilhar** (o quadrado com a seta) → **"Adicionar ao ecrã principal"**.
(No iOS tem de ser sempre pelo Safari — não funciona instalar a partir do Chrome no iPhone.)

## A câmara com reconhecimento de alimentos (IA)
A app usa a API de visão da Claude (Anthropic) para identificar o que está no prato. Precisas de:
1. Criar uma conta e uma chave de API em https://console.anthropic.com
2. Na app: **Perfil → Inteligência Artificial → colar a chave**

A chave fica guardada **apenas no teu telemóvel** (`localStorage`), nunca é enviada para outro lado além da própria Anthropic quando fotografas uma refeição. Cada pedido a esta API tem um custo muito pequeno (cêntimos), pago diretamente por ti na tua conta Anthropic — a app em si não cobra nada.

Sem chave configurada, tudo o resto da app (treino, sono, receitas, registo manual de refeições, stress) funciona normalmente — só o botão da câmara fica indisponível.

## Onde ficam os teus dados
Tudo fica guardado **só no teu telemóvel**, no armazenamento local do navegador (`localStorage`). Não há servidor, não há conta, não há sincronização entre dispositivos.
- Isto significa: se limpares os dados do navegador/PWA, perdes o histórico.
- Usa o botão **Perfil → Exportar backup** regularmente para guardares uma cópia (ficheiro `.json`) num sítio seguro (o teu email, Drive, etc.).
- Se um dia quiseres sincronizar entre telemóvel e computador, ou fazer backup automático, isso implica adicionar uma base de dados/servidor — não está incluído nesta versão, mas é uma evolução natural.

## Como o índice de stress é calculado
Combina três coisas:
- **Tempo de ecrã** — só o tempo que passas com *esta app* aberta (o iOS e o Android não permitem que apps de terceiros leiam o tempo de ecrã total do telemóvel, por razões de privacidade).
- **A tua última noite de sono.**
- **A tua auto-avaliação** (o cursor em "Como te sentes agora?").

É uma aproximação para te ajudar a notar padrões — não é uma medição clínica de stress.

## Limitações desta primeira versão (para seres honesto contigo próprio)
- Sem notificações push, sem sincronização entre dispositivos, sem login.
- Sem integração com relógios/pulseiras (Garmin, Apple Watch, etc.) — os dados de treino são inseridos manualmente.
- O reconhecimento de alimentos por foto é uma estimativa da IA, não uma medição exata de calorias.
