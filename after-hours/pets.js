/* wei-meng.org/after-hours: Nearby's animals drop in now and then (the owner's call, Nov 5).
   Some visits (kept for the visit in sessionStorage "ah_pets") Miso, Yuzu or Mantou wander over from the town and perch on
   top of a project's phone, drawn with the town's own sprites (FBWorld.petSvg from /fbkit/fb.js). They walk about, sleep at
   their town hours, and a tap either does something or points to one of the after-hours projects. ?pets=1 brings all three,
   ?pets=0 none. Nothing is sent anywhere. Written to /after-hours/pets.js by build/after_hours.py. */
(function () {
  var W = window.FBWorld; if (!W || !W.petSvg) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll("article.proj")).filter(function (a) { return a.querySelector(".shot"); });
  if (!cards.length) return;
  var reduce = false; try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  function li() {
    var l = ""; try { l = (window.FBL && FBL.get()) || ""; } catch (e) {}
    if (!l) l = document.documentElement.lang || "en"; l = String(l).toLowerCase();
    return /^zh-(hant|tw|hk|mo)/.test(l) ? 2 : /^zh/.test(l) ? 1 : /^es/.test(l) ? 3 : /^ca/.test(l) ? 4 : 0;
  }
  var NAME = { miso: "Miso", yuzu: "Yuzu", dog: "Mantou" };
  var ARIA = ["{n}, from Nearby. Tap to say hello", "{n}，来自近邻。点一下打个招呼", "{n}，來自近鄰。點一下打個招呼", "{n}, de Cerca. Toca para saludar", "{n}, d'A Prop. Toca per saludar"];
  // what they say about the project they're sitting on (cats / dog)
  var ABOUT = {
    "little-things": {
      cat: ["*bats at Popo's jar until a paper falls out* Mrrp. A little thing, for you.", "*用爪子拨婆婆的罐子，掉出一张纸条* 喵。一件小事，给你的。", "*用爪子撥婆婆的罐子，掉出一張紙條* 喵。一件小事，給你的。", "*da zarpazos al tarro de Popo hasta que cae un papel* Miau. Una cosita, para ti.", "*dona cops de pota al pot de la Popo fins que en cau un paper* Mèu. Una coseta, per a tu."],
      dog: ["*noses Popo's jar across the floor* Woof! There's a little thing in there for you.", "*用鼻子把婆婆的罐子推过来* 汪！里面有一件小事等着你。", "*用鼻子把婆婆的罐子推過來* 汪！裡面有一件小事等著你。", "*empuja con el hocico el tarro de Popo* ¡Guau! Ahí dentro hay una cosita para ti.", "*empeny amb el morro el pot de la Popo* Bub! Aquí dins hi ha una coseta per a tu."] },
    "a-few-stems": {
      cat: ["*sniffs the lavender, sneezes, sniffs it again* Mrrp. Tie a few for someone: A Few Stems.", "*闻闻薰衣草，打个喷嚏，又闻一下* 喵。扎几枝花送人吧：几枝花。", "*聞聞薰衣草，打個噴嚏，又聞一下* 喵。紮幾枝花送人吧：幾枝花。", "*huele la lavanda, estornuda, la vuelve a oler* Mrrr. Ata unas flores para alguien: Cuatro Flores.", "*olora l'espígol, esternuda, el torna a olorar* Mrrr. Lliga unes flors per a algú: Quatre Flors."],
      dog: ["*brings you one daisy, a little chewed* Woof! Someone should get flowers today: A Few Stems.", "*叼来一朵有点被咬过的雏菊* 汪！今天该有人收到花：几枝花。", "*叼來一朵有點被咬過的雛菊* 汪！今天該有人收到花：幾枝花。", "*te trae una margarita, un poco mordisqueada* ¡Guau! Hoy alguien debería recibir flores: Cuatro Flores.", "*et porta una margarida, una mica mossegada* Bub! Avui algú hauria de rebre flors: Quatre Flors."] },
    "borrowed-pages": {
      cat: ["*falls asleep on an open book* Mrrp. Someone down the street has this one. Ask them: Borrowed Pages.", "*趴在一本摊开的书上睡着了* 呼噜。这本书在街那头的谁手里，去问问吧：借来的书。", "*趴在一本攤開的書上睡著了* 呼嚕。這本書在街那頭的誰手裡，去問問吧：借來的書。", "*se duerme encima de un libro abierto* Mrrr. Alguien de tu calle tiene este. Pídeselo: Páginas Prestadas.", "*s'adorm damunt d'un llibre obert* Mrrr. Algú del teu carrer té aquest. Demana-l'hi: Pàgines Manllevades."],
      dog: ["*carries a paperback over, very gently* Woof! A real book from a neighbour. Go and meet them: Borrowed Pages.", "*小心翼翼地叼来一本平装书* 汪！邻居手里真的书，去见见 TA 吧：借来的书。", "*小心翼翼地叼來一本平裝書* 汪！鄰居手裡真的書，去見見 TA 吧：借來的書。", "*trae un libro de bolsillo con mucho cuidado* ¡Guau! Un libro de verdad de un vecino. Ve a conocerlo: Páginas Prestadas.", "*porta un llibre de butxaca amb molt de compte* Bub! Un llibre de debò d'un veí. Vés a conèixer-lo: Pàgines Manllevades."] },
    "nearby": {
      cat: ["*looks back toward the town* Meow. Home is Nearby. The counter at Next Door is warm.", "*回头望向小镇* 喵。家在近邻。隔壁的吧台是暖的。", "*回頭望向小鎮* 喵。家在近鄰。隔壁的吧檯是暖的。", "*mira hacia el pueblo* Miau. Casa es Cerca. La barra de Al Lado está calentita.", "*mira cap al poble* Mèu. Casa és A Prop. La barra d'Al Costat és calenta."],
      dog: ["*tugs your sleeve toward the town* Woof! Nearby. There are pigeons in the square.", "*拽着你的袖子往小镇走* 汪！近邻。广场上有鸽子。", "*拽著你的袖子往小鎮走* 汪！近鄰。廣場上有鴿子。", "*te tira de la manga hacia el pueblo* ¡Guau! Cerca. En la plaza hay palomas.", "*t'estira la màniga cap al poble* Bub! A Prop. A la plaça hi ha coloms."] },
    "station": {
      cat: ["*curls up on the warm window sill of the train* Mrrp. Get off wherever you like: Nearby Station.", "*蜷在火车暖暖的窗台上* 呼噜。想在哪站下车都行：近邻站。", "*蜷在火車暖暖的窗台上* 呼嚕。想在哪站下車都行：近鄰站。", "*se acurruca en el alféizar tibio del tren* Mrrr. Bájate donde quieras: Estación Cerca.", "*s'arrauleix a l'ampit tebi del tren* Mrrr. Baixa on vulguis: Estació A Prop."],
      dog: ["*sits up very straight, as if the 7:40 might come in* Woof. Nearby Station: a window seat, and any stop you like.", "*坐得笔直，好像七点四十那班车随时会进站* 汪。近邻站：一个靠窗的座位，想在哪站下都行。", "*坐得筆直，好像七點四十那班車隨時會進站* 汪。近鄰站：一個靠窗的座位，想在哪站下都行。", "*se sienta muy derecho, como si fuera a llegar el de las 7:40* Guau. Estación Cerca: un asiento junto a la ventana y cualquier parada.", "*s'asseu molt dret, com si hagués d'arribar el de les 7:40* Bub. Estació A Prop: un seient a la finestra i qualsevol parada."]
    },
    "home-ground": {
      cat: ["*curls up inside a tiny house* Mrrrp. Build one with your family: Home Ground.", "*蜷进一座小房子里* 呼噜。和家人一起盖一个吧：我们的家园。", "*蜷進一座小房子裡* 呼嚕。和家人一起蓋一個吧：我們的家園。", "*se acurruca dentro de una casita* Mrrr. Construye una con los tuyos: Nuestro Rincón.", "*s'arrauleix dins d'una caseta* Mrrr. Construeix-ne una amb els teus: El Nostre Racó."],
      dog: ["*carries over a tiny roof tile* Woof! Home Ground: a town your people build together.", "*叼来一小片屋瓦* 汪！我们的家园：一座你和家人一起盖的小镇。", "*叼來一小片屋瓦* 汪！我們的家園：一座你和家人一起蓋的小鎮。", "*trae una tejita en la boca* ¡Guau! Nuestro Rincón: un pueblo que construyen los tuyos.", "*porta una teuladeta a la boca* Bub! El Nostre Racó: un poble que construeixen els teus."] },
    "handoff": {
      cat: ["*sits on a postcard addressed very far away* Meow. For someone in another city: Handoff.", "*坐在一张寄往远方的明信片上* 喵。给在另一座城市的那个人：Handoff。", "*坐在一張寄往遠方的明信片上* 喵。給在另一座城市的那個人：Handoff。", "*se sienta encima de una postal que va muy lejos* Miau. Para alguien en otra ciudad: Handoff.", "*s'asseu damunt d'una postal que va molt lluny* Mèu. Per a algú en una altra ciutat: Handoff."],
      dog: ["*waits by the door, ears up, as if someone's coming home* Woof. Handoff, for two people far apart.", "*竖着耳朵守在门口，像是有人要回家* 汪。Handoff，给分隔两地的两个人。", "*豎著耳朵守在門口，像是有人要回家* 汪。Handoff，給分隔兩地的兩個人。", "*espera junto a la puerta con las orejas tiesas, como si alguien volviera a casa* Guau. Handoff, para dos personas lejos.", "*espera a la porta amb les orelles dretes, com si algú tornés a casa* Bub. Handoff, per a dues persones lluny."] },
    "twelve-grapes": {
      cat: ["*pats a grape off the table and watches it roll* Mrrp. One for every month: Twelve Grapes.", "*把一颗葡萄拍下桌，看着它滚走* 喵。一个月一颗：十二颗葡萄。", "*把一顆葡萄拍下桌，看著它滾走* 喵。一個月一顆：十二顆葡萄。", "*tira una uva de la mesa y la mira rodar* Miau. Una por cada mes: Las Doce Uvas.", "*fa caure un gra de la taula i el mira rodolar* Mèu. Un per cada mes: Els Dotze Grans."],
      dog: ["*sits very close to your feet, as if the clock might strike* Woof. Twelve Grapes: New Year's Eve at Popo's table.", "*紧紧挨着你的脚坐下，好像钟随时要敲响* 汪。十二颗葡萄：在婆婆家的饭桌跨年。", "*緊緊挨著你的腳坐下，好像鐘隨時要敲響* 汪。十二顆葡萄：在婆婆家的飯桌跨年。", "*se sienta pegado a tus pies, como si fuera a sonar el reloj* Guau. Las Doce Uvas: Nochevieja en la mesa de Popo.", "*s'asseu enganxat als teus peus, com si el rellotge hagués de tocar* Bub. Els Dotze Grans: la nit de Cap d'Any a la taula de la Popo."]
    },
    "vocab": {
      cat: ["*meows in Catalan, probably* Mèu. A few words in someone else's language: Vocab.", "*大概是在用加泰罗尼亚语喵* Mèu。学几句别人语言里的话：Vocab。", "*大概是在用加泰隆尼亞語喵* Mèu。學幾句別人語言裡的話：Vocab。", "*maúlla en catalán, seguramente* Mèu. Unas palabras en el idioma de otra persona: Vocab.", "*miola en cantonès, segurament* Miu. Unes paraules en la llengua d'una altra persona: Vocab."],
      dog: ["*barks once in Cantonese, he says* Wōu! Learn how someone says good morning: Vocab.", "*说自己刚才那声是粤语* 汪！学一句别人的早安：Vocab。", "*說自己剛才那聲是粵語* 汪！學一句別人的早晨：Vocab。", "*ladra una vez en cantonés, según él* ¡Wōu! Aprende cómo dice buenos días otra persona: Vocab.", "*borda un cop en cantonès, segons ell* Wōu! Aprèn com diu bon dia una altra persona: Vocab."] }
  };
  var ACT = {
    cat: [["purr", ["*purrs and kneads the top of the phone*", "*一边呼噜一边在手机上踩奶*", "*一邊呼嚕一邊在手機上踩奶*", "*ronronea y amasa el borde del móvil*", "*ronca i pasta la vora del mòbil*"]],
          ["roll", ["*rolls over, paws up* Mrrp?", "*翻过来露出肚皮* 喵？", "*翻過來露出肚皮* 喵？", "*se tumba panza arriba* ¿Mrrp?", "*s'estira panxa enlaire* Mrrp?"]],
          ["hop", ["*pounces on a speck of light*", "*扑向一小点光*", "*撲向一小點光*", "*salta sobre un puntito de luz*", "*salta sobre un puntet de llum*"]]],
    dog: [["wag", ["*wags so hard his whole back end wiggles* Woof!", "*尾巴摇得整个屁股都在晃* 汪！", "*尾巴搖得整個屁股都在晃* 汪！", "*mueve la cola tanto que se le menea todo el trasero* ¡Guau!", "*remena tant la cua que se li belluga tot el darrere* Bub!"]],
          ["spin", ["*spins in a circle, twice* Woof woof!", "*原地转了两圈* 汪汪！", "*原地轉了兩圈* 汪汪！", "*da dos vueltas sobre sí mismo* ¡Guau guau!", "*fa dues voltes sobre si mateix* Bub bub!"]],
          ["bow", ["*play bow: front down, tail up* Woof?", "*前爪趴下、尾巴翘起，邀你一起玩* 汪？", "*前爪趴下、尾巴翹起，邀你一起玩* 汪？", "*se agacha delante y levanta la cola: ¿jugamos?* ¿Guau?", "*s'ajup davant i aixeca la cua: juguem?* Bub?"]]]
  };
  var WAKE = { cat: ["*opens one eye, then the other* …mrrp.", "*先睁开一只眼，再睁开另一只* ……喵。", "*先睜開一隻眼，再睜開另一隻* ……喵。", "*abre un ojo, luego el otro* …mrrp.", "*obre un ull, després l'altre* …mrrp."],
               dog: ["*yawns enormously, tail thumping* …woof.", "*打了个大哈欠，尾巴拍着地* ……汪。", "*打了個大哈欠，尾巴拍著地* ……汪。", "*bosteza enorme, la cola golpea el suelo* …guau.", "*fa un badall enorme, la cua pica a terra* …bub."] };

  // who comes this visit
  function roll() {
    var q = /[?&]pets=(\d)/.exec(location.search), force = q ? q[1] : null;
    if (force === "0") return [];
    try { if (!force) { var s = sessionStorage.getItem("ah_pets"); if (s) return JSON.parse(s); } } catch (e) {}
    var who = [];
    if (force === "1") who = ["miso", "yuzu", "dog"];
    else if (Math.random() < .55) { var pool = ["miso", "yuzu", "dog"].sort(function () { return Math.random() - .5; }), r = Math.random(); who = pool.slice(0, r < .5 ? 1 : r < .85 ? 2 : 3); }
    var spots = cards.map(function (c) { return c.id; }).sort(function () { return Math.random() - .5; });
    var out = who.map(function (k, i) { return { k: k, at: spots[i % spots.length] }; });
    try { if (!force) sessionStorage.setItem("ah_pets", JSON.stringify(out)); } catch (e) {}
    return out;
  }
  var guests = roll(); if (!guests.length) return;

  var css = document.createElement("style"); css.textContent =
    "article.proj{position:relative}" +
    ".ahp{position:absolute;z-index:5;left:0;top:0;width:var(--w);height:var(--h);transition:left var(--t,0s) linear;pointer-events:none}" +
    ".ahp-btn{all:unset;position:absolute;inset:0;cursor:pointer;pointer-events:auto;-webkit-tap-highlight-color:transparent}" +
    ".ahp-btn:focus-visible{outline:2px solid #F6B65B;outline-offset:4px;border-radius:8px}" +
    ".ahp-fig{position:absolute;inset:0;transform-origin:50% 100%}" +
    ".ahp-fig svg{display:block;width:100%;height:100%;image-rendering:pixelated}" +
    ".ahp.left .ahp-fig{transform:scaleX(-1)}" +
    ".ahp .legs2{visibility:hidden}" +
    ".ahp.walk .legs{animation:ahpA .32s steps(1) infinite}.ahp.walk .legs2{animation:ahpB .32s steps(1) infinite}" +
    "@keyframes ahpA{0%{visibility:visible}50%{visibility:hidden}}@keyframes ahpB{0%{visibility:hidden}50%{visibility:visible}}" +
    ".ahp .tail{transform-box:fill-box;transform-origin:100% 100%;animation:ahpT 2.6s ease-in-out infinite}" +
    ".ahp.dog .tail{transform-origin:100% 100%;animation-duration:1.3s}" +
    "@keyframes ahpT{0%,100%{transform:rotate(0)}50%{transform:rotate(-14deg)}}" +
    ".ahp.do-wag .tail{animation:ahpT .18s linear infinite}.ahp.do-wag .ahp-fig{animation:ahpWag .18s linear 8}" +
    "@keyframes ahpWag{50%{transform:translateY(-2px) rotate(2deg)}}.ahp.left.do-wag .ahp-fig{animation-name:ahpWagL}@keyframes ahpWagL{0%,100%{transform:scaleX(-1)}50%{transform:scaleX(-1) translateY(-2px) rotate(2deg)}}" +
    ".ahp.do-spin .ahp-fig{animation:ahpSpin .5s ease-in-out 2}@keyframes ahpSpin{50%{transform:scaleX(-1) translateY(-6px)}}" +
    ".ahp.do-bow .ahp-fig{animation:ahpBow 1.1s ease-in-out}@keyframes ahpBow{30%,70%{transform:rotate(-12deg) translateY(2px)}}.ahp.left.do-bow .ahp-fig{animation-name:ahpBowL}@keyframes ahpBowL{0%,100%{transform:scaleX(-1)}30%,70%{transform:scaleX(-1) rotate(-12deg) translateY(2px)}}" +
    ".ahp.do-roll .ahp-fig{animation:ahpRoll 1.4s ease-in-out}@keyframes ahpRoll{35%,65%{transform:translateY(-4px) rotate(180deg) translateY(-8px)}}" +
    ".ahp.do-hop .ahp-fig{animation:ahpHop .6s cubic-bezier(.3,1.6,.5,1)}@keyframes ahpHop{40%{transform:translateY(-22px) scaleY(1.06)}80%{transform:translateY(0) scaleY(.9)}}.ahp.left.do-hop .ahp-fig{animation-name:ahpHopL}@keyframes ahpHopL{0%,100%{transform:scaleX(-1)}40%{transform:scaleX(-1) translateY(-22px)}80%{transform:scaleX(-1) scaleY(.9)}}" +
    ".ahp.do-purr .ahp-fig{animation:ahpPurr .35s ease-in-out 6}@keyframes ahpPurr{50%{transform:translateY(1px) scaleY(.96)}}.ahp.left.do-purr .ahp-fig{animation-name:ahpPurrL}@keyframes ahpPurrL{0%,100%{transform:scaleX(-1)}50%{transform:scaleX(-1) translateY(1px) scaleY(.96)}}" +
    ".ahp-z{position:absolute;right:-6px;top:-14px;font:400 12px 'Space Mono',monospace;color:#F4ECDD;opacity:0;pointer-events:none}" +
    ".ahp.asleep .ahp-z{animation:ahpZ 2.8s ease-in-out infinite}@keyframes ahpZ{0%{opacity:0;transform:translate(0,4px)}30%{opacity:.85}100%{opacity:0;transform:translate(8px,-12px)}}" +
    ".ahp-hrt{position:absolute;left:50%;top:-6px;color:#E2553F;font-size:13px;pointer-events:none;animation:ahpH 1.4s ease-out forwards}@keyframes ahpH{to{opacity:0;transform:translate(var(--dx),-34px) scale(1.3)}}" +
    ".ahp-bub{position:absolute;z-index:6;width:max-content;max-width:min(260px,calc(100vw - 32px));padding:12px 14px 13px;border-radius:16px;background:#F4ECDD;color:#1A1424;box-shadow:0 14px 34px rgba(0,0,0,.45);font:400 14px/1.45 'Plus Jakarta Sans',system-ui,'PingFang SC','Microsoft YaHei',sans-serif;opacity:0;transform:translateY(6px);transition:opacity .2s,transform .25s cubic-bezier(.23,1,.32,1);pointer-events:auto}" +
    ".ahp-bub.on{opacity:1;transform:none}" +
    ".ahp-bub b{display:block;font:400 11px 'Space Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:#8E5A1E;margin-bottom:3px}" +
    ".ahp-bub i{font-style:italic;color:#5A4E66}" +
    ".ahp-bub a{display:inline-block;margin-top:8px;padding:6px 12px;border-radius:999px;background:#1A1424;color:#F6B65B;font:400 12px 'Space Mono',monospace;text-decoration:none}" +
    ".ahp-bub a:focus-visible{outline:2px solid #E2553F;outline-offset:2px}" +
    ".ahp-bub::after{content:'';position:absolute;left:var(--ax,24px);bottom:-7px;width:14px;height:14px;background:#F4ECDD;transform:rotate(45deg);border-radius:3px}" +
    "@media (prefers-reduced-motion:reduce){.ahp,.ahp *{animation:none!important;transition:none!important}.ahp.asleep .ahp-z{opacity:.7}}";
  document.head.appendChild(css);

  var PX = innerWidth < 640 ? 3 : 3.5, bub = null, bubFor = null, bubT = 0;
  function hourNow() { try { return W.hour(); } catch (e) { var d = new Date(); return d.getHours() + d.getMinutes() / 60; } }
  function sleeps(k) { var h = hourNow(); return k === "dog" ? (h >= 22 || h < 6 || (h >= 14 && h < 15.5)) : (h >= 23 || h < 6); }
  function woke(k) { try { return Date.now() - (+sessionStorage.getItem("ah_woke_" + k) || 0) < 15 * 60e3; } catch (e) { return false; } }
  function line(arr) { var l = li(); return arr[l] || arr[0]; }
  function fmt(s) { var d = document.createElement("span"); s.split(/(\*[^*]+\*)/).forEach(function (p) { if (!p) return; if (/^\*.*\*$/.test(p)) d.appendChild(Object.assign(document.createElement("i"), { textContent: p.slice(1, -1) })); else d.appendChild(document.createTextNode(p)); }); return d; }

  function closeBub() { if (!bub) return; var b = bub; bub = null; bubFor = null; clearTimeout(bubT); b.classList.remove("on"); setTimeout(function () { b.remove(); }, 220); }
  function say(p, text, link) {
    closeBub();
    var b = document.createElement("div"); b.className = "ahp-bub"; b.setAttribute("role", "status");
    var nm = document.createElement("b"); nm.textContent = NAME[p.k]; b.appendChild(nm); b.appendChild(fmt(text));
    if (link) { b.appendChild(document.createElement("br")); var a = document.createElement("a"); a.href = link.href; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = link.name + " ↗"; b.appendChild(a); }
    p.card.appendChild(b);
    // above the animal, kept inside the card
    var cw = p.card.clientWidth, bw = b.offsetWidth, bh = b.offsetHeight, px = p.x + p.shot.offsetLeft, left = Math.max(0, Math.min(cw - bw, px + p.w / 2 - bw / 2));
    b.style.left = left + "px"; b.style.top = (p.top - bh - 12) + "px"; b.style.setProperty("--ax", Math.max(14, Math.min(bw - 28, px + p.w / 2 - left - 7)) + "px");
    requestAnimationFrame(function () { b.classList.add("on"); var r = b.getBoundingClientRect(); if (r.top < 76) scrollBy({ top: r.top - 88, behavior: reduce ? "auto" : "smooth" }); });   // not under the sticky header
    bub = b; bubFor = p; clearTimeout(bubT);
    bubT = setTimeout(function () { if (bub === b && !b.matches(":hover") && !b.contains(document.activeElement)) closeBub(); }, link ? 11000 : 5000);
  }
  document.addEventListener("click", function (e) { if (bub && !bub.contains(e.target) && !(bubFor && bubFor.el.contains(e.target))) closeBub(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && bub) { var p = bubFor; closeBub(); try { p.btn.focus({ preventScroll: true }); } catch (x) {} } });

  var pets = [];
  guests.forEach(function (g) {
    var card = document.getElementById(g.at), shot = card && card.querySelector(".shot"); if (!shot) return;
    if (pets.some(function (q) { return q.k === g.k; })) return;
    var cat = g.k !== "dog", w = Math.round((cat ? 18 : 22) * PX), h = Math.round((cat ? 14 : 16) * PX);
    var el = document.createElement("div"); el.className = "ahp " + (cat ? "cat" : "dog");
    el.style.setProperty("--w", w + "px"); el.style.setProperty("--h", h + "px");
    var fig = document.createElement("div"); fig.className = "ahp-fig";
    var z = document.createElement("span"); z.className = "ahp-z"; z.textContent = "z";
    var btn = document.createElement("button"); btn.type = "button"; btn.className = "ahp-btn"; btn.setAttribute("aria-label", line(ARIA).replace("{n}", NAME[g.k]));
    el.appendChild(fig); el.appendChild(z); el.appendChild(btn); card.appendChild(el);
    var go = card.querySelector(".go"), h3 = card.querySelector("h3");
    var p = { k: g.k, cat: cat, card: card, shot: shot, el: el, fig: fig, btn: btn, w: w, h: h, x: 0, top: 0, taps: 0, busy: false, seen: false, asleep: false, last: "",
      link: go ? { href: go.href, name: (h3 ? h3.textContent : "").trim() } : null };
    p.draw = function () { p.asleep = sleeps(p.k) && !woke(p.k); fig.innerHTML = W.petSvg(p.k, { asleep: p.asleep }); el.classList.toggle("asleep", p.asleep); fig.style.marginTop = p.asleep ? (3 * PX) + "px" : ""; };
    p.place = function (x, ms) {
      var max = Math.max(0, shot.offsetWidth - w - 10); x = Math.max(10, Math.min(max, x));
      if (ms && !reduce) { el.style.setProperty("--t", ms + "ms"); el.classList.toggle("left", x < p.x); el.classList.add("walk"); clearTimeout(p.wt); p.wt = setTimeout(function () { el.classList.remove("walk"); }, ms); }
      else el.style.setProperty("--t", "0s");
      p.x = x; p.top = shot.offsetTop - h + 2;
      el.style.top = p.top + "px"; el.style.left = (shot.offsetLeft + x) + "px";
    };
    p.draw();
    // arrive from one side of the phone when the card comes into view, then pick a spot
    var fromLeft = Math.random() < .5; p.place(fromLeft ? 10 : 9999); el.style.opacity = "0";
    btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); tap(p); });
    pets.push(p);
  });
  if (!pets.length) return;

  function arrive(p) {
    if (p.seen) return; p.seen = true; p.el.style.transition = "opacity .4s"; p.el.style.opacity = "1";
    if (p.asleep) { p.place(p.shot.offsetWidth * (.3 + Math.random() * .4)); return; }
    var to = p.shot.offsetWidth * (.25 + Math.random() * .5); p.place(to, Math.abs(to - p.x) / 45 * 1000);
    setTimeout(function () { p.el.style.transition = ""; }, 450);
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (!e.isIntersecting) return; pets.forEach(function (p) { if (p.card === e.target) arrive(p); }); io.unobserve(e.target); }); }, { threshold: .35 });
    pets.forEach(function (p) { io.observe(p.card); });
  } else pets.forEach(arrive);

  function act(p, name) {
    p.busy = true; p.el.classList.add("do-" + name);
    if (name === "purr") for (var i = 0; i < 3; i++) (function (i) { setTimeout(function () { var hh = document.createElement("span"); hh.className = "ahp-hrt"; hh.textContent = "♥"; hh.style.setProperty("--dx", (i - 1) * 12 + "px"); p.el.appendChild(hh); setTimeout(function () { hh.remove(); }, 1500); }, i * 380); })(i);
    setTimeout(function () { p.el.classList.remove("do-" + name); p.busy = false; }, name === "roll" ? 1450 : name === "bow" ? 1150 : name === "spin" ? 1050 : name === "hop" ? 650 : name === "purr" ? 2150 : 1500);
  }
  function tap(p) {
    if (bubFor === p && bub) { closeBub(); }
    if (p.asleep) { try { sessionStorage.setItem("ah_woke_" + p.k, String(Date.now())); } catch (e) {} p.draw(); say(p, line(WAKE[p.cat ? "cat" : "dog"])); act(p, p.cat ? "hop" : "wag"); return; }
    p.taps++;
    if (p.taps % 2 === 1 && p.link) {   // about the project it's sitting on
      var ab = ABOUT[p.card.id]; say(p, line(ab ? ab[p.cat ? "cat" : "dog"] : ACT[p.cat ? "cat" : "dog"][0][1]), p.link);
      act(p, p.cat ? "purr" : "wag");
    } else {   // something just for fun, never the same twice in a row
      var list = ACT[p.cat ? "cat" : "dog"].filter(function (a) { return a[0] !== p.last; }), a = list[Math.floor(Math.random() * list.length)];
      p.last = a[0]; say(p, line(a[1])); act(p, a[0]);
    }
  }
  // now and then, wander along the top of the phone
  function idle() {
    pets.forEach(function (p) {
      if (!p.seen || p.busy || p.asleep || bubFor === p || reduce) return;
      if (Math.random() < .45) { var to = Math.random() * p.shot.offsetWidth; p.place(to, Math.abs(to - p.x) / 40 * 1000); }
      else if (Math.random() < .3) { p.el.classList.toggle("left"); }
    });
    setTimeout(idle, 4000 + Math.random() * 5000);
  }
  setTimeout(idle, 6000);
  // the clock moves on (a cat may fall asleep while you read); the layout may change size
  setInterval(function () { pets.forEach(function (p) { var s = sleeps(p.k) && !woke(p.k); if (s !== p.asleep && !p.busy) p.draw(); }); }, 60e3);
  var rz = 0; addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { closeBub(); pets.forEach(function (p) { p.place(p.x); }); }, 150); });
})();
