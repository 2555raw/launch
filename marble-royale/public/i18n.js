/* Two languages, because the people who hold the coin and the person running it
   are rarely reading the same one. Pick from the browser on a first visit,
   remember the choice after that. Every string the page can show lives here, so
   nothing is half translated. */

(function () {
  'use strict';

  const EN = {
    'phase.lobby': 'NEXT RACE IN',
    'phase.locked': 'FIELD CLOSED',
    'phase.racing': 'RACING',
    'phase.result': 'NEXT RACE IN',
    'pot.label': 'POT THIS ROUND',
    'btn.connect': 'CONNECT WALLET',
    'btn.join': 'JOIN THIS RACE',
    'btn.joined': "YOU'RE IN",
    'btn.auto': 'auto-join every race',
    'hud.racing': 'racing',
    'hud.watching': 'watching',
    'tab.live': 'LIVE', 'tab.chat': 'CHAT', 'tab.winners': 'WINNERS', 'tab.top': 'TOP',
    'live.head': 'THE FIELD',
    'live.hint': 'Tap a marble to cheer it on.',
    'chat.ph': 'say something',
    'winners.head': 'PAST WINNERS',
    'winners.verify': 'verify',
    'top.head': 'MOST WINS',
    'winner.title': 'WINNER',
    'winner.takes': 'to the wallet above',
    'winner.note': 'Paid by hand from the creator wallet. Tap the address to copy it.',
    'winner.you': 'THAT IS YOU',
    'winner.none': 'Nobody joined that one.',
    'winner.pending': 'the fees from those five minutes',
    'status.watch': 'Watching. Connect a wallet to get a marble.',
    'status.canjoin': 'You are in the stand. Press join and a marble is yours.',
    'status.joined': 'Your marble is on the grid. Good luck.',
    'status.closed': 'The field is closed. You are in the next one.',
    'status.racing': 'They are off.',
    'status.result': 'Race over. Next field is open.',
    'status.gate': 'Holders only: you need {need} {ticker} to race.',
    'status.full': 'This race is full. You are queued for the next one.',
    'how.head': 'HOW IT WORKS',
    'how.body': 'A race starts every five minutes, on the clock. Connect your wallet, press join, and one marble on the track is yours. The first marble across the line takes the creator fees collected during those five minutes, paid by hand to the wallet shown on screen.',
    'fair.head': 'PROVABLY FAIR',
    'fair.body': 'Before anyone joins, the server publishes a hash of the seed it will use. When the field closes, the seed itself is published. The seed decides the course and every bounce, so anyone can replay the race and check the winner.',
    'toast.copied': 'Address copied',
    'toast.signin': 'Sign the message in your wallet to prove it is yours.',
    'toast.nowallet': 'No Solana wallet found. Open this page inside Phantom, Solflare or Backpack.',
    'toast.rejected': 'You cancelled the signature.',
    'toast.joined': 'You are in this race',
    'toast.auto': 'Auto-join is on. A marble is yours every race.',
    'toast.cheer': 'Cheered!',
    'toast.win': 'You won! The wallet on screen is the one being paid.',
    'banner.go': 'GO!',
    'banner.locked': 'FIELD CLOSED',
    'banner.soon': 'GET IN',
    'field.you': 'you',
    'field.empty': 'Nobody on the grid yet. Be the first.',
    'winners.empty': 'No races yet.',
    'winners.paid': 'paid',
    'winners.due': 'to pay',
    'sec': 's'
  };

  const ES = {
    'phase.lobby': 'PRÓXIMA EN',
    'phase.locked': 'INSCRIPCIÓN CERRADA',
    'phase.racing': 'EN CARRERA',
    'phase.result': 'PRÓXIMA EN',
    'pot.label': 'BOTE DE LA RONDA',
    'btn.connect': 'CONECTAR CARTERA',
    'btn.join': 'ENTRAR A LA CARRERA',
    'btn.joined': 'YA ESTÁS DENTRO',
    'btn.auto': 'entrar solo en cada carrera',
    'hud.racing': 'compitiendo',
    'hud.watching': 'mirando',
    'tab.live': 'EN VIVO', 'tab.chat': 'CHAT', 'tab.winners': 'GANADORES', 'tab.top': 'TOP',
    'live.head': 'LA PARRILLA',
    'live.hint': 'Toca una canica para animarla.',
    'chat.ph': 'escribe algo',
    'winners.head': 'GANADORES ANTERIORES',
    'winners.verify': 'verificar',
    'top.head': 'MÁS VICTORIAS',
    'winner.title': 'GANADOR',
    'winner.takes': 'para la cartera de arriba',
    'winner.note': 'Se paga a mano desde la cartera del creador. Toca la dirección para copiarla.',
    'winner.you': 'ESE ERES TÚ',
    'winner.none': 'No entró nadie en esa.',
    'winner.pending': 'las fees de esos cinco minutos',
    'status.watch': 'Estás mirando. Conecta una cartera y tendrás canica.',
    'status.canjoin': 'Estás en la grada. Dale a entrar y la canica es tuya.',
    'status.joined': 'Tu canica está en la parrilla. Suerte.',
    'status.closed': 'La inscripción está cerrada. Entras en la siguiente.',
    'status.racing': 'Han salido.',
    'status.result': 'Carrera terminada. Ya puedes entrar en la siguiente.',
    'status.gate': 'Solo holders: necesitas {need} {ticker} para correr.',
    'status.full': 'Esta carrera está llena. Estás en cola para la siguiente.',
    'how.head': 'CÓMO FUNCIONA',
    'how.body': 'Cada cinco minutos, en punto, empieza una carrera. Conecta tu cartera, dale a entrar y una canica de la pista es tuya. La primera en cruzar la meta se lleva las fees de creador de esos cinco minutos, pagadas a mano a la cartera que aparece en pantalla.',
    'fair.head': 'JUSTO Y COMPROBABLE',
    'fair.body': 'Antes de que entre nadie, el servidor publica el hash de la semilla que va a usar. Al cerrar la inscripción publica la semilla. La semilla decide el circuito y cada rebote, así que cualquiera puede repetir la carrera y comprobar quién ganó.',
    'toast.copied': 'Dirección copiada',
    'toast.signin': 'Firma el mensaje en tu cartera para demostrar que es tuya.',
    'toast.nowallet': 'No hay cartera de Solana. Abre esta página dentro de Phantom, Solflare o Backpack.',
    'toast.rejected': 'Has cancelado la firma.',
    'toast.joined': 'Estás dentro de esta carrera',
    'toast.auto': 'Entrada automática activada. Tendrás canica en cada carrera.',
    'toast.cheer': '¡Ánimo enviado!',
    'toast.win': '¡Has ganado! La cartera en pantalla es la que se paga.',
    'banner.go': '¡YA!',
    'banner.locked': 'INSCRIPCIÓN CERRADA',
    'banner.soon': 'ENTRA YA',
    'field.you': 'tú',
    'field.empty': 'Todavía no hay nadie. Sé el primero.',
    'winners.empty': 'Aún no hay carreras.',
    'winners.paid': 'pagado',
    'winners.due': 'por pagar',
    'sec': 's'
  };

  const DICT = { en: EN, es: ES };
  let lang = localStorage.getItem('mr.lang') ||
    ((navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en');

  function t(key, vars) {
    let s = (DICT[lang] && DICT[lang][key]) || EN[key] || key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }

  function apply(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    (root || document).querySelectorAll('[data-i18n-ph]').forEach((el) => {
      el.placeholder = t(el.dataset.i18nPh);
    });
    document.documentElement.lang = lang;
  }

  window.I18N = {
    t, apply,
    get lang() { return lang; },
    other: () => (lang === 'es' ? 'EN' : 'ES'),
    toggle() {
      lang = lang === 'es' ? 'en' : 'es';
      localStorage.setItem('mr.lang', lang);
      apply();
      return lang;
    }
  };
})();
