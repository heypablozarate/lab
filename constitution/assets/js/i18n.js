// Language layer. English lives in the HTML; Spanish lives here.
// The page swaps text in place and the wheel redraws its labels.
(function () {
  'use strict';

  var SIG = '<span class="signature">PabloZarate<span class="signature__mark">™</span></span>';
  var SIGA = '<a class="signature" href="https://pablozarate.com" rel="author">PabloZarate<span class="signature__mark">™</span></a>';

  var ES = {
    doc: 'La constitución del Diseñador, por PabloZarate™',
    desc: 'Un modelo para repensar qué hace a un diseñador en la era de la IA, construido sobre los cimientos que Walter Gropius trazó para la Bauhaus en 1922.',
    alt: 'El modelo dibujado como cinco anillos concéntricos, de la base afuera a construir en el centro.',
    t01: '<strong>La constitución del Diseñador</strong>',
    t02: '<span>01</span>La base',
    t03: '<span>02</span>Estudios',
    t04: '<span>03</span>Materiales',
    t05: '<span>04</span>Innegociablemente Humano',
    t06: '<span>05</span>Construir',
    t07: '<span class="ln" style="--n:0"><span>La constitución</span></span><span class="ln" style="--n:1"><span>del Diseñador</span></span>',
    t08: 'Un modelo para pensar qué hace a un diseñador en la era de la IA. Construido sobre los cimientos que Walter Gropius trazó para la Bauhaus y adaptado por ' + SIG + '',
    t09: 'Decidir o no decidir…',
    t10: 'Diseñar es decidir, desde la definición misma de la palabra: qué tiene que existir, de qué va a estar hecho, para quién y con qué consecuencias. El que define es el diseñador, se haya preparado para serlo o no.',
    t11: 'Quienes celebran que la IA por fin va a liberar a los diseñadores para ocuparse de la estrategia y el liderazgo poco entienden de diseño, y mucho menos de estrategia o de liderazgo.<br><br>Ese lugar estuvo siempre disponible. <strong>Lo novedoso es lo que recuperamos.</strong>',
    t12: 'Último momento: los diseñadores recuperan dominio sobre la tecnología.',
    t13: 'Esto no es una revolución. Es un Renacimiento.',
    t14: 'La IA permite recuperar el dominio sobre los materiales y sobre lo construido. Código, datos, modelos y distribución vuelven a estar al alcance de quien diseña.',
    t15: 'Y hacía falta… La consecuencia de pensar todo de forma minima y viable llevó a métodos de trabajos pobres que llenó la industria de productos mediocres (vainillas) y sobre complejizados.',
    t16: 'Estamos frente a una oportunidad de remediar esto y poner de nuevo la experiencia como diferenciador. Pero para esto un diseñador debe dominar y entender el punto de quiebre del material (tecnología) que decide usar.',
    t17: 'No hay experiencia sin ejercitar la práctica consciente.',
    t18: 'BAUHAUS',
    t19: 'Para entender lo que viene, primero hay que mirar atrás',
    t20: 'En 1922 Walter Gropius diseñó el plan de estudios de la Bauhaus como una serie de anillos concéntricos. ',
    t21: 'Afuera, los conceptos fundacionales. En el medio, los talleres para entender los materiales: piedra, madera, metal, arcilla, vidrio, color y textil. Y en el centro, Bau: construir, la síntesis de todo lo anterior.',
    t22: 'Cada aprendiz trabajaba a la vez con dos maestros, uno de oficio y uno de forma. Los talleres se convirtieron en laboratorios donde se desarrollaban los prototipos que la industria después producía en serie.',    
    t23: 'Definir la forma de una lámpara o de una silla exigía conocer el metal y la madera con que iba a fabricarse.',
    t24: '<strong>La constitución del Diseñador</strong> propone reimaginar ese dibujo para el oficio de hoy. Es un marco que ordena lo elemental que debería tener todo diseñador en este nuevo Renacimiento de la profesión gracias a la IA.',
    t25: 'Construir como núcleo.',
    t26: 'Anillo 01',
    t27: 'La base',
    t28: 'El anillo exterior tiene dos mitades. Una es la gramática de la forma, válida en cualquier medio. La otra es la praxis consciente, que convierte el trabajo en experiencia.',
    t29: 'Fundamentos de forma',
    t30: 'Composición, color, tipografía y tiempo. Las reglas con las que se ordena cualquier cosa que se ve, se lee o se escucha, sea una página, una interfaz o una voz.',
    t31: 'Praxis consciente',
    t32: 'Design sense, criterio y oficio. Se forman haciendo y prestando atención a lo que pasó: qué funcionó, qué no y por qué.',
    t33: 'La forma sigue la función.',
    t34: 'Anillo 02',
    t35: 'Estudios',
    t36: 'Lo que se estudia para entender un problema antes de resolverlo. Gropius lo ordenaba empezando por la observación, con el estudio de la naturaleza y de los materiales, y buena parte del oficio se sigue aprendiendo ahí: la carpintería japonesa encastra la madera sin clavos, y los carpinteros de templos ubican cada pieza según la dirección en que creció el árbol.',
    t37: 'Representación',
    t38: 'Bocetos, prototipos y especificaciones. Las formas de volver discutible una idea antes de que exista.',
    t39: 'Personas',
    t40: 'Quién va a usar lo que se construye, en qué contexto y con qué en juego.',
    t41: 'Limitantes',
    t42: 'Todo tiene límites, y parte del trabajo es investigarlos. Quien lo entiende elige desde el utensilio hasta el cajón de la cocina donde va a guardarse.',
    t43: 'Espacio, tiempo e interacción',
    t44: 'Cómo algo se mueve, responde y se despliega frente a una persona.',
    t45: 'Sistemas',
    t46: 'Componentes, reglas y relaciones que permiten que mucha gente construya con coherencia.',
    t47: 'Agentes',
    t48: 'Qué pueden hacer, dónde fallan y qué contexto necesitan para trabajar bien.',
    t49: 'Massimo Vignelli lo resumía en tres palabras, design is one: un mapa, una vajilla y una casa se diseñan con el mismo criterio.',
    t50: 'Si se puede diseñar algo bien, se puede diseñar cualquier cosa.',
    t51: 'Anillo 03',
    t52: 'Materiales',
    t53: 'El diseño digital trabaja con siete materiales. Gropius armó un taller para cada uno de los suyos, porque cada uno se trabaja distinto y tiene su propio punto de quiebre, y la formación en esos talleres ya incluía contabilidad, cálculo de precios y contratos. La madera se abre a lo largo de la veta; el código, en el caso que nadie probó; un modelo, en la pregunta que nadie anticipó.',
    t54: 'Distribución',
    t55: 'Cómo lo construido llega a las personas: canales, costos y acceso. Acá entra el negocio, entendido como construir algo con una finalidad real.',
    t56: 'Datos',
    t57: 'Lo que un producto sabe, de dónde lo sabe y cuánto se puede confiar en eso.',
    t58: 'Código',
    t59: 'Lo que el diseño digital delegó durante años. Vuelve a estar al alcance.',
    t60: 'Interfaz',
    t61: 'Las superficies que la gente toca, lee y recorre.',
    t62: 'Movimiento',
    t63: 'Transiciones, respuesta y ritmo. Una demora también es una decisión.',
    t64: 'Modelos',
    t65: 'El primer material probabilístico. Responde distinto cada vez, así que su comportamiento se diseña con el mismo cuidado que su resultado.',
    t66: 'Lenguaje',
    t67: 'Textos, nombres y prompts. Muchas veces la primera interfaz es una oración.',
    t68: 'Conocer un material es saber dónde se quiebra.',
    t69: 'Anillo 04',
    t70: 'Innegociablemente Humano',
    t71: 'Tres ejes deben permanecer humanos, todo lo demas puede ser automatizado.',
    t72: 'Visión',
    t73: 'La idea clara de qué vale la pena construir y por qué.',
    t74: 'Confianza',
    t75: 'La gente le confía su tiempo, sus datos o su dinero a alguien, y ese alguien tiene nombre.',
    t76: 'Responsabilidad',
    t77: 'Por cada tarea delegada, y por lo que el trabajo les hace a las personas y a la sociedad una vez que sale al mundo. Incluye dejar claro quién responde por qué.',
    t78: 'Toda tarea se puede delegar, excepto pensar… Pensar no es una tarea, es un privilegio.',
    t79: 'Anillo 05',
    t80: 'Construir',
    t81: 'Cuando construir se vuelve barato, el diseño de la <strong>intencionalidad</strong> es lo distintivo.',
    t82: 'Definir el Qué y el porqué',
    t83: 'Qué hay que construir y qué problema real resuelve.',
    t84: 'Cómo funciona',
    t85: 'El comportamiento de punta a punta. Entenderlo, al menos a nivel estructural, es condición para ser diseñador.',
    t86: 'Cómo falla',
    t87: 'Cómo debería funcionar cuando no funciona. Ahí se ve el criterio.',
    t88: 'Cómo opera',
    t89: 'Lo que necesita para seguir funcionando una vez que está en el mundo: mantenimiento, costos y soporte.',
    t90: 'Este es el nuevo piso.',
    t91: 'No hay atajos… y eso es bueno.',
    t92: 'Si bien nada está definido, lo cierto es que el diseño no es sólo una profesión, sino un modelo mental que se adaptará a su época.',
    t93: 'Construir bien requiere criterio. Esta nueva Constitution busca ayudar a entender las capacidades que, mas allá si son ejecutadas o no por una persona, deben ser entendidas y dominadas por la persona que diseña.',
    t94: 'Pero el criterio no se puede <em>promptear</em>, no hay <em>skills</em>, no hay aplicación mágica… Toca sentarse y aprender haciendo, construyendo. No hay atajos.',
    t95: 'El futuro es para los Diseñadores que Construyen.',
    t96: 'Mi apuesta al futuro',
    t97: 'Veo una nueva oleada de fundadores con background de diseño, empresas unipersonales y solopreneurs que se ocupen en serio de cómo el diseño mejora la vida de las personas.',
    t98: 'Toda transición produce mucha basura antes de acomodarse, y esta va a producir la suya. Eso será una oportunidad para que los juniors aprendan corrigiendo todo ese <em>slop vibe-codeado</em>.',
    t99: 'El futuro es para los diseñadores que construyen.',
    t100: 'Ahora, a construir.',
    t101: 'La constitución<br>del Diseñador',
    t102: 'Un modelo para repensar qué hace a un diseñador en la era de IA.',
    t103: 'Manifiesto de Diseño',
    t104: 'Escrito en Buenos Aires, 2026 · Con cariño, '+ SIGA +'',
    t105: 'Compartir',
    t106: 'Copiar link' 
  };

  // Labels drawn on the wheel.
  var WHEEL = {
    en: {
      title: 'The Designer’s Constitution',
      credit: 'Redrawn after Walter Gropius, Bauhaus curriculum, Weimar 1922',
      ground: ['Foundations of form', 'Composition, color, typography, time', 'Conscious praxis', 'Design sense, judgment, craft'],
      studies: ['Representation', 'People', 'Limits', 'Space, time and interaction', 'Systems', 'Agents'],
      materials: ['Distribution', 'Data', 'Code', 'Interface', 'Motion', 'Models', 'Language'],
      core: ['Vision', 'Trust', 'Responsibility'],
      build: 'Build',
      answers: ['What and why', 'How it works', 'How it fails', 'How it runs']
    },
    es: {
      title: 'La constitución del diseñador',
      credit: 'Redibujado a partir de Walter Gropius, plan de estudios de la Bauhaus, Weimar 1922',
      ground: ['Fundamentos de forma', 'Composición, color, tipografía, tiempo', 'Praxis consciente', 'Design sense, criterio, oficio'],
      studies: ['Representación', 'Personas', 'Limitantes', 'Espacio, tiempo e interacción', 'Sistemas', 'Agentes'],
      materials: ['Distribución', 'Datos', 'Código', 'Interfaz', 'Movimiento', 'Modelos', 'Lenguaje'],
      core: ['Visión', 'Confianza', 'Responsabilidad'],
      build: 'Construir',
      answers: ['Qué y por qué', 'Cómo funciona', 'Cómo falla', 'Cómo opera']
    }
  };

  var EN = null; // captured from the page on first switch
  var listeners = [];
  var lang = 'en';

  // Order: ?lang= in the URL, then a choice made with the EN/ES buttons,
  // then the first English or Spanish entry in the system languages.
  function system() {
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i] || '').toLowerCase().split('-')[0];
      if (code === 'en' || code === 'es') return code;
    }
    return 'en';
  }

  function read() {
    var q = location.search.match(/[?&]lang=(en|es)\b/);
    if (q) return q[1];
    try { var s = localStorage.getItem('pz-lang'); if (s === 'en' || s === 'es') return s; } catch (e) {}
    return system();
  }

  function capture() {
    EN = { doc: document.title };
    document.querySelectorAll('[data-i18n]').forEach(function (el) { EN[el.dataset.i18n] = el.innerHTML; });
    var img = document.querySelector('[data-i18n-alt]');
    if (img) EN.alt = img.getAttribute('alt');
  }

  function apply(next) {
    if (!EN) capture();
    var dict = next === 'es' ? ES : EN;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = dict[el.dataset.i18n];
      if (v != null) el.innerHTML = v;
    });
    var img = document.querySelector('[data-i18n-alt]');
    if (img) img.setAttribute('alt', dict.alt);
    document.title = dict.doc;
    var md = document.querySelector('meta[name="description"]');
    if (md) { if (!EN.desc) EN.desc = md.content; md.content = next === 'es' ? ES.desc : EN.desc; }
    document.documentElement.lang = next;
    document.querySelectorAll('.lang button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.lang === next ? 'true' : 'false');
    });
    var changed = next !== lang;
    lang = next;
    if (changed) listeners.forEach(function (fn) { fn(next); });
  }

  window.PZLang = {
    get: function () { return lang; },
    wheel: function () { return WHEEL[lang]; },
    onChange: function (fn) { listeners.push(fn); },
    set: apply
  };

  // This script sits at the end of <body>, so the page is already parsed.
  document.querySelectorAll('.lang button').forEach(function (b) {
    b.addEventListener('click', function () {
      // Only an explicit choice is remembered, so the system language keeps
      // deciding for everyone who never touched the switch.
      try { localStorage.setItem('pz-lang', b.dataset.lang); } catch (e) {}
      apply(b.dataset.lang);
    });
  });
  capture();
  apply(read());
})();
