# Мадэль даных: §-статыстыка (v3)

Документ-кантракт для Front. Апісвае **фармат `scope`**, **схему сховішча v3** (`localStorage`
ключ `mt6_state_v3`), **міграцыю з v2**, **устойлівасць да сапсаваных даных** і **чыстыя функцыі**
(`parseScope`, `normalizeScope`, `getSubStats`, `addResult`, `levelFor`), якія Front абавязаны
рэалізаваць 1:1. Крыніца §-разбіўкі — `docs/SUBS.md` (38 §§), словы ключоў — `generators.js`
(`window.SUBS`, `window.GEN_BY_SUB`).

Код у гэтым докуменце — даведачная рэалізацыя; яна праверана **78 аўтатэстамі**, і ўсе
канкрэтныя значэнні ў прыкладах ніжэй — рэальны вывад гэтай рэалізацыі, а не прыдуманыя.

Статус: гатова да рэалізацыі. Код піша Front, гэты файл — спека.

---

## 0. Галоўнае ў трох радках

1. `scope` — радок: `'decimals'` (увесь раздзел), `'decimals:S4'` (канкрэтны § 4) або `'mix'`.
   Кананічны ключ § уключае літару `S`: `subs['decimals:S4']` — гэта **тое ж** мноства ключоў,
   што ў `window.GEN_BY_SUB` (`generators.js`) і ў `window.SUBS[ch][].id` (`'S4'`).
2. Усе адказы пішуцца **толькі ў `subs['chapter:S<N>']`**, а раздзелавыя лічыльнікі
   `topics[chapter]` аўтаматычна вылічваюцца тым жа выклікам (каб дашборд і статыстыка, якія
   ўжо існуюць, не зламаліся).
3. `subs[]` — адзіная крыніца праўды для §; `topics[chapter].level` — дэнармалізаваны кэш
   (сярэдні ўзровень пакрытых §§), яго пералічвае `addResult`.

---

## 1. Фармат `scope`

### 1.1 Граматыка

```
scope    ::= "mix" | chapter | chapter ":" "S" N
chapter  ::= "decimals" | "percent" | "sets" | "rational" | "coords" | "geometry"
N        ::= цэлы лік 1..SUBS_COUNT[chapter]  (у кананічным запісе — без вядучых нулёў)
```

| Від | Прыклад | Сэнс | Дзе захоўваецца |
|---|---|---|---|
| `chapter` | `'decimals'` | увесь раздзел, пытанні з **усіх** яго §§ | `topics['decimals']` (лічыльнікі), `subs['decimals:SN']` (дэталі) |
| `chapter:SN` | `'decimals:S4'` | адзін § | `subs['decimals:S4']` |
| `mix` | `'mix'` | усе раздзелы | нічога свайго: агрэгат па ўсім стане |

`'mix'` — рэжым трэніроўкі, а **не** месца захавання: любое пытанне ў рэжыме `mix` усё роўна
належыць канкрэтнаму §, таму `addResult` атрымлівае ключ гэтага § (`'chapter:SN'`).

### 1.2 Кананізацыя

`parseScope` — адзінае месца, дзе разбіраецца і кананізуецца `scope`. Ён трыміць прабелы
(у тым ліку ўнутры запісу), прыводзіць да ніжняга рэгістра, дапускае прэфікс `S`/`s` і скідвае
вядучыя нулі. Кананічны вынік — заўсёды `chapter:S<N>`.

| Уваход | Вынік (`key`) |
|---|---|
| `'decimals'` | `'decimals'` (раздзел) |
| `'decimals:S4'` | `'decimals:S4'` |
| `' Decimals : s04 '` | `'decimals:S4'` (трыманне, рэгістр, вядучы нуль) |
| `'decimals:4'` | `'decimals:S4'` (лічбавы псеўданім; прымаем для сумяшчальнасці, але пішам заўсёды `S`-форму) |
| `'decimals:04'` | `'decimals:S4'` |
| `'mix'` | `'mix'` |
| `'decimals:S0'`, `'rational:S10'`, `'sets:S5'` | `null` (па-за межамі § раздзела) |
| `'decimals:'`, `'decimals:S1x'`, `'decimals:x3'`, `'algebra:S1'`, `'decimals2:S1'`, `''` | `null` |
| `null`, `undefined`, `42`, `{}` | `null` |

### 1.3 Дапушчальныя `SN` (з `docs/SUBS.md` / `window.SUBS`)

| chapter | §§ | `SUBS_COUNT` | кананічныя ключы |
|---|---|---|---|
| `decimals` | 10 | 10 | `decimals:S1` … `decimals:S10` |
| `percent` | 7 | 7 | `percent:S1` … `percent:S7` |
| `sets` | 4 | 4 | `sets:S1` … `sets:S4` |
| `rational` | 9 | 9 | `rational:S1` … `rational:S9` |
| `coords` | 3 | 3 | `coords:S1` … `coords:S3` |
| `geometry` | 5 | 5 | `geometry:S1` … `geometry:S5` |
| **разам** | **38** | | 38 ключоў = 38 ключоў `GEN_BY_SUB` |

`SUBS_COUNT` — канстанта са статычнымі значэннямі (табліца вышэй) і **аўтакарэкцыяй** з
`window.SUBS[ch].length`, калі `generators.js` ужо загружаны. Гэта гарантуе, што мадэль і
рэестр генератараў не разыдуцца (AC-1 у `spec-sub.md`).

### 1.4 Розніца паміж `kind`

| Пытанне | `getSubStats` | `addResult` | `levelFor` |
|---|---|---|---|
| `'decimals:S4'` | статыстыка § з `subs` | **піша** (`subs` + `topics.decimals`) | узровень § |
| `'decimals'` | статыстыка раздзела з `topics` + `covered` | `null` (не піша!) | узровень раздзела |
| `'mix'` | агрэгат па ўсіх раздзелах | `null` (не піша!) | сярэдні ўзровень |
| нешта іншае | `null` | `null` | `3` (нейтральны) |

---

## 2. Сховішча v3

### 2.1 Ключы

```js
const STORE_KEY  = 'mt6_state_v3';   // пішам і чытаем
const LEGACY_KEY = 'mt6_state_v2';   // чытаем пры міграцыі; выдаляецца толькі «Скінуць прагрэс»
```

`saveState()` піша **поўны** стан у `mt6_state_v3` (без дэльт). Запіс — `try/catch`; памылкі
(квота, прыватны рэжым) праглынаюцца: гульня працягваецца ў памяці.

### 2.2 Поўная схема

```json
{
  "v": 3,
  "xp": 250, "level": 3, "solved": 40, "correct": 30,
  "streakDays": 4, "lastDay": "2026-11-25",
  "todayCount": 3, "todayDate": "2026-11-26", "dailyGoal": 10,
  "hadPerfectSession": true,
  "badges": ["first", "ten"],
  "history": [],
  "settings": { "sound": false },
  "topics": {
    "decimals": { "correct": 20, "total": 25, "level": 6 },
    "percent":  { "correct": 10, "total": 15, "level": 4 },
    "sets":     { "correct": 0,  "total": 0,  "level": 3 },
    "rational": { "correct": 0,  "total": 0,  "level": 3 },
    "coords":   { "correct": 0,  "total": 0,  "level": 3 },
    "geometry": { "correct": 0,  "total": 0,  "level": 3 }
  },
  "subs": {
    "decimals:S1": { "correct": 8, "total": 10, "level": 6 },
    "decimals:S3": { "correct": 3, "total": 4,  "level": 5 }
  }
}
```

### 2.3 Агульныя палі — як у v2 (не мяняюцца)

| Поле | Тып | Сэнс |
|---|---|---|
| `v` | `3` | версія схемы (новае ў v3; у v2 не было) |
| `xp`, `level`, `solved`, `correct` | int ≥ 0 | агульны прагрэс; `level = floor(xp/100)+1` |
| `streakDays`, `lastDay`, `todayCount`, `todayDate`, `dailyGoal` | int / `'YYYY-MM-DD'` | дзённая мэта і streak |
| `hadPerfectSession` | bool | бейдж «Бездакорная сесія» |
| `badges` | `string[]` | id з фіксаванага спісу |
| `history` | `array` | рэзерв ад v2, да 200 запісаў; лагіка на яго не абапіраецца |
| `settings` | `{sound: bool}` | налады |
| `topics` | `{chapter: {correct, total, level}}` | раздзелавыя лічыльнікі (як у v2) |

Семантыка `topics[chapter]` у v3 **такая ж, як у v2** (`correct`/`total` — назапашаныя за ўсе
часы, `level` — 1..10), з адзінай розніцай: `level` цяпер вылічвае мадэль (сярэдні па §§), а не
выпадковы `Math.random()<0.7`. Гэта робіць стан дэтэрмінаваным і тэставальным.

### 2.4 `subs['chapter:SN']`

| Поле | Тып | Інварыянты |
|---|---|---|
| `correct` | int ≥ 0 | `correct ≤ total` |
| `total` | int ≥ 0 | колькасць адказаў па гэтым § за ўсе часы |
| `level` | int 1..10 | старт `3`; `+1` за правільны, `−1` за няправільны, мяжы 1 і 10 |

Ключ — кананічны `scope` віду `sub` (`'decimals:S4'`). Запісы §§ без адказаў могуць існаваць
(пасля санацыі), але яны не ўплываюць на ўзровень раздзела.

### 2.5 Інварыянты (правераныя)

1. `Object.keys(subs)` ⊂ 38 кананічных ключоў `chapter:S<N>` (ключ заўсёды з літарай `S`).
2. Для любога запісу: `0 ≤ correct ≤ total`, `1 ≤ level ≤ 10`, усе — цэлыя.
3. `topics` утрымлівае **роўна** 6 вядомых раздзелаў (невядомыя выдаляюцца санацыяй).
4. Пасля міграцыі `subs = {}`, а `topics` захоўвае v2-значэнні.
5. Кожны адказ дадае роўна `1` у `subs[key].total` і роўна `1` у `topics[chapter].total`
   (ніводнага двайнога падліку).
6. `sum(subs[ch:*].correct) ≤ topics[ch].correct`: у `topics` ёсць v2-гісторыя, якой няма ў §§.
7. Калі ў раздзеле ёсць хаця б адзін § з `total > 0`, тады
   `topics[ch].level = round(сярэдняе level пакрытых §§)` (мяжы 1..10).

### 2.6 Пытанне (сувязь з генератарамі)

`chooseQuestion(scope)` вяртае аб'ект пытання, дапоўнены палямі мадэлі:

| Поле | Адкуль | Навошта |
|---|---|---|
| `topicId` | `chapter` з `parseScope` (для `mix` — выбраны раздзел) | загаловак, XP, `topics` |
| `subId` | кананічны ключ § (`'decimals:S4'`) — **заўсёды вядомы**, нават у `mix` | `addResult`, `GEN_BY_SUB`, подпіс «§4» |
| `sub` | `'S4'` | кароткая метка для UI (як `data-sub` у `design-sub.md`) |
| `difficulty` | `levelFor(subId)` (1..10) | складанасць генератара |

Генератары бяруцца з `window.GEN_BY_SUB[subId]`; для `scope='decimals'` § выбіраецца сярод §§
раздзела, для `'mix'` — сярод усіх 38. **Складанасць бярэцца па §** (`levelFor('decimals:S4')`),
а не па раздзеле: інакш унутры раздзела адаптацыя не працуе і слабы § застанецца слабым.
У рэжыме `mix` — таксама па § выбранага пытання.

Каб даведацца § для пытання, Front будуе адваротную мапу `GEN_SCOPE` (`fn → key`) адзін раз пры
ініцыялізацыі — гэта патрабуе `spec-sub.md` §7 і не патрабуе змены кантракту генератара.

---

## 3. Міграцыя і сумяшчальнасць

### 3.1 Алгарытм `loadState()`

```
1. raw3 = localStorage['mt6_state_v3']
2. if raw3 парсіцца ў аб'ект   → return sanitizeState(raw3)      // звычайны шлях
3. raw2 = localStorage['mt6_state_v2']                           // міграцыя
4. if raw2 парсіцца ў аб'ект   → S = sanitizeState(raw2)         // subs адсутнічае → {}
                                 saveState()                     // адразу пішам v3
                                 return S
5. return defaultState()                                         // нічога няма / усё бітае
```

Асобны выпадак пункта 2: калі `raw3` ёсць, але біты, а `raw2` валідны — мігруем з v2. Гэта
свядомае паводзіна: лепш страціць v3-дэльту, чым увесь прагрэс.

### 3.2 Што мігруецца

| v2 | v3 |
|---|---|
| усе агульныя палі | без змяненняў (пасля санацыі) |
| `topics` | без змяненняў; адсутныя раздзелы дапаўняюцца `{correct:0,total:0,level:3}` |
| — | `subs: {}` (новае) |
| — | `v: 3` (новае) |

Прыклад (правераны): v2
`{xp:250, level:3, solved:40, correct:30, topics:{decimals:{correct:20,total:25,level:6},
percent:{correct:10,total:15,level:4}}, settings:{sound:false}}` →

* `subs === {}`, `topics.decimals === {correct:20, total:25, level:6}`,
  `topics.geometry === {correct:0, total:0, level:3}`;
* `getSubStats('decimals')` → `correct:20, total:25, acc:80, level:6, covered:0, subsCount:10`;
* `getSubStats('mix')` → `correct:30, total:40, acc:75, level:5, covered:0, chaptersWithData:2`.

**Заўвага пра ўзровень раздзела (важна для дызайну).** Адразу пасля міграцыі
`topics[chapter].level` роўны v2-значэнню (у прыкладзе — 6). Пасля **першага** v3-адказу ў
гэтым раздзеле ўзровень пералічваецца як сярэдні па пакрытых §§ і можа стаць ніжэйшым:
`addResult('decimals:S1', true)` → `topics.decimals = {correct:21, total:26, level:4}`.
Гэта чакана: §§ — крыніца праўды, а v2-узровень быў ацэнкай без дэталізацыі. Каб подпіс
«ур. N» не «скакаў», бярыце яго з `levelFor(chapter)` — гэта той жа сярэдні па §§.

### 3.3 Сумяшчальнасць

* **v2 не выдаляем пры міграцыі.** Калі трэба адкаціць фронт, стары білд знойдзе свой ключ і
  працуе, як раней (ён проста не ўбачыць адказы, зробленыя на v3).
* **v3 не піша ў v2.** Пасля першага запісу v3 крыніца праўды — толькі `mt6_state_v3`.
* **Наперад-сумяшчальнасць.** Невядомыя **верхнеўзроўневыя** палі пераносяцца як ёсць, каб
  будучая v4 не губляла даныя пры запісе старым білдам. Невядомыя раздзелы ў `topics` і
  невядомыя/некананічныя ключы ў `subs` — **выдаляюцца**.
* **Назад-сумяшчальнасць схемы.** Палі `v` няма ў v2 — гэта не памылка: `sanitizeState`
  заўсёды ставіць `v: 3`.
* `history` абмяжоўваецца 200 апошнімі запісамі (абарона ад разростання).

### 3.4 «Скінуць прагрэс»

`reset-btn` → выдаліць **абодва** ключы (`mt6_state_v3` і `mt6_state_v2`), `S = defaultState()`,
`saveState()`. Выдаленне v2 тут абавязковае: інакш «скінуты» прагрэс мог бы вярнуцца пры
наступным збоі v3 (пункт 4 алгарытму §3.1).

---

## 4. Устойлівасць да сапсаваных даных

### 4.1 Агульныя правілы

| Сітуацыя | Паводзіны |
|---|---|
| `JSON.parse` кідае (абрэзаны/біты радок) | `defaultState()` (або міграцыя з v2, калі ён валідны) |
| Значэнне — масіў, радок, лік, `null` | тое ж самае: не аб'ект → дэфолт/міграцыя |
| Аб'ект без палёў (`{}`, `{"xp":1}`) | адсутныя палі замяняюцца дэфолтамі, лічыльнікі 0 |
| Не-лік, `NaN`, `Infinity` у лікавым полі | `0` (радкі накшталт `"8"` **не** прыводзяцца — гэта тыповая прыкмета псавання) |
| Адмоўны лік у лічыльніку | `0` |
| `correct > total` | `correct = total` |
| `level` па-за 1..10 | `>10 → 10`; `≤0` ці не-лік → `3` (нейтральны) |
| Дата не выгляду `YYYY-MM-DD` | `null` |
| `dailyGoal` па-за 1..50 | бліжэйшая мяжа; не-лік → `10` |
| `badges` — не масіў / чужыя id | пакідаюцца толькі вядомыя радкі |
| `settings` — не аб'ект | `{sound:true}` |
| `subs` — не аб'ект | `{}` |
| Ключ `subs` не кананічны / невядомы § | запіс выдаляецца (`'decimals:S99'`, `'algebra:S1'`, `'decimals'`, `'decimals:S0'`) |
| Ключ `subs` кананізуецца (`' Decimals:S2 '`, `'percent:s02'`, `'decimals:4'`) | запіс захоўваецца пад кананічным ключом (`'decimals:S4'`, `'percent:S2'`) |
| Запіс `subs` не аб'ект (`null`, `'junk'`) | `{correct:0, total:0, level:3}` |

Санацыя **ідэмпатэнтная**: `sanitizeState(sanitizeState(x)) === sanitizeState(x)` — паўторны
запуск не мяняе стан. Гэта дазваляе выклікаць яе на кожным запісе без дрыфту.

### 4.2 Прыклад санацыі (правераны)

Уваход:

```json
{ "xp": -5, "level": 0, "solved": 3, "correct": 99, "dailyGoal": 0, "streakDays": "abc",
  "topics": { "decimals": { "correct": 7, "total": 2, "level": 42 },
              "unknown":  { "correct": 1, "total": 1, "level": 3 } },
  "subs": { "decimals:S1":  { "correct": 10, "total": 4, "level": 99 },
            "decimals:S2":  { "correct": null, "total": "8", "level": -3 },
            "decimals:S99": { "correct": 1, "total": 1, "level": 3 },
            "algebra:S1":   { "correct": 1, "total": 1, "level": 3 },
            "decimals":     { "correct": 1, "total": 1, "level": 3 },
            "decimals:S0":  null,
            "decimals:S4":  "junk",
            "percent:s02":  { "correct": 2, "total": 3, "level": 6 } },
  "badges": ["first", "hacked", 7], "history": [], "settings": null }
```

Выхад:

| Пале | Вынік | Чаму |
|---|---|---|
| `xp` / `level` / `solved` / `correct` | `0` / `1` / `3` / `3` | адмоўнае → 0; `level 0` → 1; `correct 99 > solved 3` → 3 |
| `dailyGoal` | `10` | не-лік → дэфолт |
| `streakDays` | `0` | радок → 0 |
| `topics.decimals` | `{correct:2, total:2, level:10}` | `correct>total` → 2; `level 42` → 10 |
| `topics.unknown` | выдалены | невядомы раздзел |
| `subs['decimals:S1']` | `{correct:4, total:4, level:10}` | `correct>total`; `level 99` → 10 |
| `subs['decimals:S2']` | `{correct:0, total:0, level:3}` | `null` → 0, радок `"8"` → 0, адмоўны `level` → 3 |
| `subs['decimals:S4']` | `{correct:0, total:0, level:3}` | значэнне — радок |
| `subs['percent:S2']` | `{correct:2, total:3, level:6}` | ключ быў `'percent:s02'` → кананізаваны |
| ключы `decimals:S99`, `algebra:S1`, `decimals`, `decimals:S0` | выдалены | па-за межамі / не кананічныя |
| `badges` | `["first"]` | `"hacked"` і `7` адкінутыя |
| `settings` | `{sound:true}` | не аб'ект → дэфолт |

### 4.3 Запіс

* `localStorage.setItem` у `try/catch`; пры `QuotaExceededError` стан у памяці застаецца
  змененым (гульня не падае) — праверана.
* Чытанне таксама ў `try/catch` (Safari ў прыватным рэжыме кідае ўжо на `getItem`).
* Ніякіх `console.*` у мадэлі: кансоль мусіць быць чыстая (патрабаванне задачы). Памылкі
  сховішча не лагуюцца.
* Мадэльныя функцыі **ніколі не кідаюць** выключэнняў і не вяртаюць `undefined`:
  няправільны `scope` → `null` (чытачы) / `null` без змяненняў стану (запіс).

---

## 5. Чыстыя функцыі (публічны API)

Агульныя правілы:

* Гэта **адзіны** інтэрфейс да `subs`. Front не мае права пісаць у `S.subs`/`S.topics` напрамую.
* Чытанне (`parseScope`, `normalizeScope`, `getSubStats`, `levelFor`, `sanitizeState`,
  `reduceResult`) — без пабочных эфектаў. Запіс (`addResult`) — адзіная функцыя з эфектам
  (мутуе `S` + `saveState()`).
* Другі неабавязковы аргумент `state` — для тэстаў (`getSubStats(scope, state)`); у UI не перадаецца.
* Функцыі трываюць «смецце» на ўваходзе: `null`, лікі, аб'екты, неіснуючыя §.

### 5.1 `parseScope(scope) → {kind, chapter, sn, subId, key} | null`

| Поле | Тып | Прыклад |
|---|---|---|
| `kind` | `'sub' \| 'chapter' \| 'mix'` | `'sub'` |
| `chapter` | `string \| null` | `'decimals'` |
| `sn` | `int \| null` | `4` (зручна для лікавых аперацый) |
| `subId` | `'S<N>' \| null` | `'S4'` (= `window.SUBS[ch][].id`) |
| `key` | `string` | `'decimals:S4'` (= ключ `window.GEN_BY_SUB`) |

### 5.2 `normalizeScope(raw) → string | null`

Тонкая абгортка: `parseScope(raw)?.key ?? null`. Менавіта яе чакае `spec-sub.md` §3.1
(`startSession(normalizeScope(raw))`).

### 5.3 `getSubStats(scope, state?) → Stats | null`

Вяртае **новы аб'ект** (не спасылку на стан) — мутацыі немагчымыя.

**Агульныя палі:**

| Поле | Тып | Заўвага |
|---|---|---|
| `scope` | `string` | кананічны ключ (`'decimals:S4'`, `'decimals'`, `'mix'`) |
| `kind` | `'sub' \| 'chapter' \| 'mix'` | |
| `chapter` | `string \| null` | `null` для `mix` |
| `sn` | `int \| null` | `null` для `chapter`/`mix` |
| `subId` | `'S<N>' \| null` | `null` для `chapter`/`mix` |
| `correct`, `total` | int | |
| `acc` | `int \| null` | **працэнт 0..100** (як у `spec-sub.md`): `Math.round(correct/total*100)`; `null` пры `total===0` |
| `ratio` | `number \| null` | доля 0..1 з акругленнем да 3 знакаў — для шырыні бараў |
| `level` | int 1..10 | заўсёды валідны, нават для пустога |
| `empty` | bool | `total === 0` |

**Дадаткова для `kind:'chapter'`:**

| Поле | Сэнс |
|---|---|
| `covered` | колькасць §§ гэтага раздзела з `total > 0` |
| `subsCount` | усяго §§ у раздзеле (`SUBS_COUNT[chapter]`) |

**Дадаткова для `kind:'mix'`:**

| Поле | Сэнс |
|---|---|
| `covered` | §§ з данымі па ўсіх раздзелах (0..38) |
| `chaptersWithData` | раздзелаў з `total > 0` (0..6) |

**Адкуль бяруцца лікі:**

| `kind` | `correct`/`total` | `level` |
|---|---|---|
| `sub` | з `subs[key]` (няма запісу → `0/0`) | `subs[key].level`; няма запісу → `3` |
| `chapter` | з `topics[chapter]` (уключае v2-гісторыю) | `topics[chapter].level` (кэш = сярэдні па пакрытых §§) |
| `mix` | сума па 6 раздзелах з `topics` | `round(сярэдняе level раздзелаў з данымі)`; няма даных → `5` |

Прыклады (правераныя):

```js
// пусты стан
getSubStats('decimals:S3')
// {scope:'decimals:S3', kind:'sub', chapter:'decimals', sn:3, subId:'S3',
//  correct:0, total:0, acc:null, ratio:null, level:3, empty:true}

getSubStats('decimals')
// {…, correct:0, total:0, acc:null, ratio:null, level:3, empty:true, covered:0, subsCount:10}

getSubStats('mix')
// {…, correct:0, total:0, acc:null, ratio:null, level:5, empty:true, covered:0, chaptersWithData:0}

// пасля addResult('percent:S1',true) x2, ('percent:S2',false), ('percent:S3',true)
getSubStats('percent:S1').level   // 5
getSubStats('percent:S2').level   // 2
getSubStats('percent:S3').level   // 4
getSubStats('percent').level      // 4   (сярэдні па §§)
getSubStats('percent').covered    // 3
getSubStats('percent').subsCount  // 7
getSubStats('mix').level          // 4   (сярэдні ўзроўняў раздзелаў з данымі)
```

### 5.4 `addResult(scope, ok) → Stats | null`

Запісвае адзін адказ. Сігнатура зафіксаваная задачай (`scope`, `ok`), таму гэта тонкая абгортка:
бярэ бягучы `S`, праводзіць яго праз `sanitizeState` (абарона ад смецця, якое магло трапіць у
памяць), выклікае чыстае ядро `reduceResult(state, parsed, ok)` і піша вынік у `S` +
`localStorage`. Чыстае ядро экспартуецца асобна — яго і тэстуюць.

**Правілы:**

1. `scope` мусіць быць віду `sub`. `'chapter'` і `'mix'` → `null`, стан **не** мяняецца.
   (У любой сесіі пытанне належыць §, таму Front кліча `addResult(current.subId, ok)`.)
2. `ok` мусіць быць `boolean`. `1`/`0`/`'true'`/`undefined` → `null`, стан не мяняецца
   (каб акругленне або `parseFloat` не рабіла з няўдачы поспех).
3. Прымяненне да §: `total += 1`; `correct += ok?1:0`; `level = clamp(level + (ok?1:-1))`, старт `3`.
4. Дэржыраванне раздзела: `topics[chapter].total += 1`, `topics[chapter].correct += ok?1:0`,
   `topics[chapter].level = round(сярэдняе level пакрытых §§)` (калі §§ яшчэ не пакрытыя —
   ранейшае значэнне).
5. Піша ў сховішча (памылкі запісу праглынаюцца).
6. Вяртае `getSubStats(key)` **пасля** змяненняў — Front можа адразу паказваць новы ўзровень.

**Прыклад лясенкі (праверана, старт 3):**

| Крок | `ok` | `level` пасля | `total` | `correct` |
|---|---|---|---|---|
| 1 | `true` | 4 | 1 | 1 |
| 2 | `true` | 5 | 2 | 2 |
| 3 | `false` | 4 | 3 | 2 |
| 4 | `true` | 5 | 4 | 3 |

Вынік: `{correct:3, total:4, acc:75, ratio:0.75, level:5}`; `topics.decimals` →
`{correct:3, total:4, level:5}`; `getSubStats('decimals').covered` → `1`.
Кліч з лічбавым псеўданімам `addResult('percent:2', true)` піша ў кананічны ключ
`'percent:S2'` (праверана).

**Важна:** узровень — гэта «рэжым складанасці» (§-адаптацыя), а не адзнака. Ён рэагуе на серыю
адказаў: правільны цягне ўверх, няправільны — уніз. Гэта свядомае падабенства да v2 (дзе было
`+1` з імавернасцю 0,7 і `−1` заўсёды), але дэтэрмінаванае: аднолькавыя адказы даюць аднолькавы
стан, таму паводзіны тэстуюцца.

### 5.5 `levelFor(scope, state?) → int 1..10`

Абгортка над `getSubStats(scope).level`; для няправільнага `scope` вяртае `3` (нейтральны
ўзровень, каб UI не ламаўся), для пустога `mix` — `5`. Ніколі не кідае і не вяртае `null`.
Выкарыстоўваецца ў `chooseQuestion` як `difficulty`.

### 5.6 Дапаможныя (унутраныя)

| Функцыя | Роля |
|---|---|
| `defaultState()` | поўны пусты стан v3 (6 раздзелаў, `subs:{}`) |
| `sanitizeState(raw)` | поўная санацыя (§4), ідэмпатэнтная |
| `sanitizeSubs(raw)` / `sanitizeSubEntry(raw)` | санацыя §-рэестра і асобнага запісу |
| `sanitizeTopics(raw)` | 6 вядомых раздзелаў, `correct ≤ total`, `level` clamp |
| `meanLevelOfSubs(state, chapter?)` | сярэдні ўзровень пакрытых §§ (раздзела або ўсіх) |
| `reduceResult(state, parsedScope, ok)` | **чыстае** ядро запісу: вяртае новы стан |

### 5.7 Даведачная рэалізацыя

```js
'use strict';
const STORE_KEY = 'mt6_state_v3';
const LEGACY_KEY = 'mt6_state_v2';

const CHAPTERS = ['decimals', 'percent', 'sets', 'rational', 'coords', 'geometry'];
const SUBS_COUNT = (function () {
  const base = { decimals: 10, percent: 7, sets: 4, rational: 9, coords: 3, geometry: 5 };
  if (typeof window !== 'undefined' && window.SUBS) {
    CHAPTERS.forEach(ch => { if (window.SUBS[ch] && window.SUBS[ch].length) base[ch] = window.SUBS[ch].length; });
  }
  return base;
})();
const DEFAULT_LEVEL = 3, MIN_LEVEL = 1, MAX_LEVEL = 10, MIX_LEVEL = 5;
const BADGE_IDS = ['first', 'ten', 'fifty', 'hundred', 'streak3', 'grade8', 'grade10', 'perfect'];

function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }
function intNonNeg(v) { const n = num(v); return n > 0 ? Math.floor(n) : 0; }
function clampLevel(v) {
  const n = Math.floor(num(v));
  if (n < MIN_LEVEL) return DEFAULT_LEVEL;          // няма / 0 / адмоўнае / NaN
  return Math.min(MAX_LEVEL, n);
}
function isDay(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
function accOf(c, t) { return t > 0 ? Math.round(c / t * 100) : null; }
function ratioOf(c, t) { return t > 0 ? Math.round(c / t * 1000) / 1000 : null; }

function defaultState() {
  const topics = {};
  CHAPTERS.forEach(ch => { topics[ch] = { correct: 0, total: 0, level: DEFAULT_LEVEL }; });
  return {
    v: 3, xp: 0, level: 1, solved: 0, correct: 0,
    streakDays: 0, lastDay: null, todayCount: 0, todayDate: null, dailyGoal: 10,
    topics, subs: {}, badges: [], hadPerfectSession: false, history: [], settings: { sound: true }
  };
}

function parseScope(scope) {
  if (scope == null) return null;
  const s = String(scope).trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  if (s === 'mix') return { kind: 'mix', chapter: null, sn: null, subId: null, key: 'mix' };
  const m = /^([a-z]+)(?::([a-z]?)(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const ch = m[1];
  if (!Object.prototype.hasOwnProperty.call(SUBS_COUNT, ch)) return null;
  if (m[3] === undefined) return { kind: 'chapter', chapter: ch, sn: null, subId: null, key: ch };
  if (m[2] && m[2] !== 's') return null;            // дазволены толькі прэфікс S
  const sn = parseInt(m[3], 10);
  if (sn < 1 || sn > SUBS_COUNT[ch]) return null;
  return { kind: 'sub', chapter: ch, sn: sn, subId: 'S' + sn, key: ch + ':S' + sn };
}

function normalizeScope(raw) { const p = parseScope(raw); return p ? p.key : null; }

function sanitizeSettings(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { sound: true };
  return { sound: raw.sound === true };
}

function sanitizeTopics(raw) {
  const out = {};
  CHAPTERS.forEach(ch => {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw[ch] : null;
    const total = src ? intNonNeg(src.total) : 0;
    let correct = src ? intNonNeg(src.correct) : 0;
    if (correct > total) correct = total;
    out[ch] = { correct, total, level: src ? clampLevel(src.level) : DEFAULT_LEVEL };
  });
  return out;
}

function sanitizeSubEntry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { correct: 0, total: 0, level: DEFAULT_LEVEL };
  }
  const total = intNonNeg(raw.total);
  let correct = intNonNeg(raw.correct);
  if (correct > total) correct = total;
  return { correct, total, level: clampLevel(raw.level) };
}

function sanitizeSubs(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  Object.keys(raw).forEach(k => {
    const p = parseScope(k);                        // кананізуе і адсякае невядомае
    if (!p || p.kind !== 'sub') return;
    out[p.key] = sanitizeSubEntry(raw[k]);
  });
  return out;
}

function sanitizeState(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = Object.assign({}, src);               // невядомыя палі пераносім
  out.v = 3;
  out.xp = intNonNeg(src.xp);
  out.level = Math.max(1, Math.floor(num(src.level)) || 1);
  out.solved = intNonNeg(src.solved);
  out.correct = Math.min(intNonNeg(src.correct), out.solved);
  out.streakDays = intNonNeg(src.streakDays);
  out.lastDay = isDay(src.lastDay) ? src.lastDay : null;
  out.todayCount = intNonNeg(src.todayCount);
  out.todayDate = isDay(src.todayDate) ? src.todayDate : null;
  out.dailyGoal = Math.min(50, Math.max(1, intNonNeg(src.dailyGoal) || 10));
  out.hadPerfectSession = src.hadPerfectSession === true;
  out.badges = Array.isArray(src.badges)
    ? src.badges.filter(b => typeof b === 'string' && BADGE_IDS.indexOf(b) >= 0) : [];
  out.history = Array.isArray(src.history) ? src.history.slice(-200) : [];
  out.settings = sanitizeSettings(src.settings);
  out.topics = sanitizeTopics(src.topics);
  out.subs = sanitizeSubs(src.subs);
  return out;
}

function subEntryOf(state, key) {
  const subs = state && state.subs;
  return subs && typeof subs === 'object' ? (subs[key] || null) : null;
}

function meanLevelOfSubs(state, chapter) {
  let sum = 0, n = 0;
  if (chapter) {
    for (let i = 1; i <= SUBS_COUNT[chapter]; i++) {
      const e = subEntryOf(state, chapter + ':S' + i);
      if (e && e.total > 0) { sum += clampLevel(e.level); n++; }
    }
  } else {
    CHAPTERS.forEach(ch => {
      for (let i = 1; i <= SUBS_COUNT[ch]; i++) {
        const e = subEntryOf(state, ch + ':S' + i);
        if (e && e.total > 0) { sum += clampLevel(e.level); n++; }
      }
    });
  }
  return n > 0 ? sum / n : null;
}

function getSubStats(scope, state) {
  const p = parseScope(scope);
  if (!p) return null;
  const st = state || S;

  if (p.kind === 'sub') {
    const e = subEntryOf(st, p.key) || { correct: 0, total: 0, level: DEFAULT_LEVEL };
    return {
      scope: p.key, kind: 'sub', chapter: p.chapter, sn: p.sn, subId: p.subId,
      correct: e.correct, total: e.total,
      acc: accOf(e.correct, e.total), ratio: ratioOf(e.correct, e.total),
      level: e.total > 0 ? clampLevel(e.level) : DEFAULT_LEVEL,
      empty: e.total === 0
    };
  }

  if (p.kind === 'chapter') {
    const t = (st.topics && st.topics[p.chapter]) || { correct: 0, total: 0, level: DEFAULT_LEVEL };
    let covered = 0;
    for (let i = 1; i <= SUBS_COUNT[p.chapter]; i++) {
      const e = subEntryOf(st, p.chapter + ':S' + i);
      if (e && e.total > 0) covered++;
    }
    return {
      scope: p.chapter, kind: 'chapter', chapter: p.chapter, sn: null, subId: null,
      correct: t.correct, total: t.total,
      acc: accOf(t.correct, t.total), ratio: ratioOf(t.correct, t.total),
      level: clampLevel(t.level),
      empty: t.total === 0, covered, subsCount: SUBS_COUNT[p.chapter]
    };
  }

  let correct = 0, total = 0, covered = 0, chaptersWithData = 0, lsum = 0;
  CHAPTERS.forEach(ch => {
    const t = (st.topics && st.topics[ch]) || { correct: 0, total: 0, level: DEFAULT_LEVEL };
    correct += t.correct; total += t.total;
    if (t.total > 0) { chaptersWithData++; lsum += clampLevel(t.level); }
    for (let i = 1; i <= SUBS_COUNT[ch]; i++) {
      const e = subEntryOf(st, ch + ':S' + i);
      if (e && e.total > 0) covered++;
    }
  });
  return {
    scope: 'mix', kind: 'mix', chapter: null, sn: null, subId: null,
    correct, total, acc: accOf(correct, total), ratio: ratioOf(correct, total),
    level: chaptersWithData > 0
      ? Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(lsum / chaptersWithData)))
      : MIX_LEVEL,
    empty: total === 0, covered, chaptersWithData
  };
}

function levelFor(scope, state) {
  const s = getSubStats(scope, state);
  return s ? s.level : DEFAULT_LEVEL;
}

/* чыстае ядро запісу: новы стан, без мутацый і без localStorage */
function reduceResult(state, p, ok) {
  const next = Object.assign({}, state);
  next.topics = Object.assign({}, state.topics);
  next.subs = Object.assign({}, state.subs);

  const cur = next.subs[p.key] && typeof next.subs[p.key] === 'object'
    ? sanitizeSubEntry(next.subs[p.key])
    : { correct: 0, total: 0, level: DEFAULT_LEVEL };
  next.subs[p.key] = {
    correct: cur.correct + (ok ? 1 : 0),
    total: cur.total + 1,
    level: ok ? Math.min(MAX_LEVEL, cur.level + 1) : Math.max(MIN_LEVEL, cur.level - 1)
  };

  const t = next.topics[p.chapter];
  if (t) {
    const mean = meanLevelOfSubs(next, p.chapter);
    next.topics[p.chapter] = {
      correct: t.correct + (ok ? 1 : 0),
      total: t.total + 1,
      level: mean === null ? clampLevel(t.level) : Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(mean)))
    };
  }
  return next;
}

/* публічны API — сігнатура зафіксаваная задачай */
function addResult(scope, ok) {
  const p = parseScope(scope);
  if (!p || p.kind !== 'sub') return null;
  if (typeof ok !== 'boolean') return null;
  S = reduceResult(sanitizeState(S), p, ok);
  saveState();
  return getSubStats(p.key, S);
}

/* сховішча */
function loadState() {
  const read = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const parse = raw => { try { return raw == null ? null : JSON.parse(raw); } catch (e) { return null; } };
  const v3 = parse(read(STORE_KEY));
  if (v3 && typeof v3 === 'object' && !Array.isArray(v3)) return sanitizeState(v3);
  const v2 = parse(read(LEGACY_KEY));                 // міграцыя
  if (v2 && typeof v2 === 'object' && !Array.isArray(v2)) {
    S = sanitizeState(v2);
    saveState();                                      // адразу фіксуем v3
    return S;
  }
  return defaultState();
}
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* квота / прыватны рэжым */ }
}
```

---

## 6. Інтэграцыйны кантракт з `app.js`

Front абавязаны зрабіць наступнае (і нічога звыш гэтага ў мадэль не дадаваць):

1. **`STORE_KEY = 'mt6_state_v3'`**, дадаць `LEGACY_KEY = 'mt6_state_v2'`; `loadState()`/`saveState()`
   па алгарытме §3.1/§5.7. `defaultState()` атрымлівае `v:3` і `subs:{}`.
2. **`submitAnswer()`**: выдаліць прамое пісьмо ў раздзел —
   `const st = S.topics[current.topicId]; st.total++; … st.correct++; … st.level++ / st.level--`
   — і выклікаць `addResult(current.subId, ok)` адзін раз на адказ, захоўваючы
   `S.correct++`, `S.solved++`, `S.xp += gain`, `bumpLevel()`, `touchDay()`, `beep()`, `burst()`.
   Інакш будзе двайны падлік (і `topics.total`, і §-рэестр).
   `S.solved` расце **заўсёды** (і за няправільны адказ) — гэта не мяняецца; `correct` у
   §-статыстыцы расце толькі за правільны (гэта робіць `addResult`).
3. **`chooseQuestion(scope)`**: генератар з пула `window.GEN_BY_SUB[subId]` (`subId` — кананічны
   ключ §); `difficulty = levelFor(subId)`. Для `'chapter'` — § сярод §§ гэтага раздзела, для
   `'mix'` — сярод усіх 38. `subId` заўсёды пішацца ў аб'ект пытання.
4. **Экран пытання**: подпіс «Раздзел · §N» браць з `parseScope(current.subId).sn`.
5. **Дашборд** (`renderStats`): у кожным раздзеле — радок §§ па `getSubStats('chapter:SN')`
   (кропка запоўненая, калі `!empty`; колер/шырыня — па `acc`; подпіс — «85% · ур. 6»),
   загаловак раздзела — `getSubStats(chapter)`. «Слабыя тэмы» — сартаванне па `acc`
   (`null` — у канец).
6. **Карткі раздзелаў** (`renderHome`): подпіс «ур. N» браць з `getSubStats(t.id).level`
   (не з `S.topics[...].level` напрамую) — так подпіс аднолькавы для міграванага і новага стану.
7. **`reset-btn`**: выдаліць абодва ключы, `S = defaultState(); saveState();` (§3.4).

Астатняе (`bumpLevel`, `touchDay`, `checkBadges`, `clampGrade`, канфеты, гук, бейджы, XP)
не змяняецца.

### 6.1 Узгадненне з `spec-sub.md` / `design-sub.md` / `generators.js`

Ключы і фарматы ўжо супадаюць: `'decimals:S4'` у `GEN_BY_SUB`, `data-scope` у дызайне і `subs[]`
тут. Пяць месцаў, дзе гэты дакумент удакладняе (а не супярэчыць) спецы:

| # | `spec-sub.md` | Тут (абавязак Front) |
|---|---|---|
| 1 | `getSubStats` для `mix` → `null` | вяртае агрэгат (надмноства: `null` бывае толькі для невядомага `scope`, таму код, які чытае `.total`, не падае) |
| 2 | `acc` — працэнт | `acc` — працэнт (як у спецы) **+** `ratio` (0..1) для бараў |
| 3 | `levelFor('mix')` → 5 | 5, калі даных няма; інакш сярэдні ўзровень раздзелаў з данымі |
| 4 | §7: `d = levelFor(ch)` | `d = levelFor(subId)` — складанасць па § (як і каментар у спецы: «§ → узровень §»); па раздзеле — толькі калі § няма |
| 5 | `v3` сапсаваны → `defaultState()`; `console.warn` пры збоі сховішча | спачатку спрабуем валідны v2 (не страчваем прагрэс); **ніякіх** `console.*` (кансоль чыстая) |

Пры розначытанні прыярытэт: гэты файл — для ключоў, фармату і паводзін мадэлі,
`spec-sub.md` — для экранаў і патокяў, `design-sub.md` — для выгляду.

---

## 7. Прыёмачныя тэсты (спека для Front)

Даведачная рэалізацыя праходзіць усе 78 асертаў. Мінімум для тэстаў Front (чаканыя значэнні —
рэальны вывад):

| # | Дзеянне / уваход | Чаканы вынік |
|---|---|---|
| 1 | `parseScope(' Decimals : s04 ')` | `{kind:'sub', chapter:'decimals', sn:4, subId:'S4', key:'decimals:S4'}` |
| 2 | `parseScope('decimals:4')` | `key === 'decimals:S4'` (лічбавы псеўданім кананізуецца) |
| 3 | `parseScope('geometry:S0')`, `('rational:S10')`, `('sets:S5')`, `('algebra:S1')`, `('decimals:x3')` | `null` |
| 4 | `getSubStats('decimals:S3')` на пустым стане | `correct:0, total:0, acc:null, ratio:null, level:3, empty:true` |
| 5 | `levelFor('nope:S1')` / `levelFor('mix')` на пустым | `3` / `5` |
| 6 | `addResult('decimals:S3', true)` ×2, `false`, `true` | лясенка `4,5,4,5`; фінал `{correct:3,total:4,acc:75,ratio:0.75,level:5}` |
| 7 | пасля #6 | `S.topics.decimals === {correct:3,total:4,level:5}` |
| 8 | `addResult('decimals', true)`, `addResult('mix', true)`, `addResult('decimals:S3', 1)` | `null`; стан не змяніўся |
| 9 | `addResult('percent:2', true)` на пустым | ключ у `subs` — `'percent:S2'` |
| 10 | 12 правільных запар у `sets:S1` | `level === 10` |
| 11 | потым 12 няправільных | `level === 1`, `total === 24` |
| 12 | `percent:S1` T,T → 5; `percent:S2` F → 2; `percent:S3` T → 4 | `getSubStats('percent').level === 4`, `covered === 3`, `subsCount === 7` |
| 13 | міграцыя v2 (§3.2) | `subs === {}`, `topics` захаваныя; `getSubStats('decimals')` → `correct:20, total:25, acc:80, level:6, covered:0, subsCount:10` |
| 14 | пасля міграцыі `addResult('decimals:S1', true)` | `topics.decimals === {correct:21,total:26,level:4}`, § → `{1,1,4}` |
| 15 | `localStorage['mt6_state_v3'] = '{oops'` (v2 няма) | `defaultState()`; гульня стартуе, кансоль пустая |
| 16 | `'"str"'`, `'[1,2,3]'`, `'null'`, `''` у v3 | дэфолт, без выключэнняў |
| 17 | санацыя прыкладу §4.2 | значэнні з табліцы §4.2 |
| 18 | біты v3 + валідны v2 | міграцыя з v2 (прагрэс не страчаны) |
| 19 | `setItem` кідае `QuotaExceededError` | `addResult` не кідае; стан у памяці абноўлены |
| 20 | `sanitizeState(sanitizeState(x))` | роўна `sanitizeState(x)` |
| 21 | кансоль пасля 10 адказаў + рэлоад | пустая (ніякіх `console.*`) |

Прыёмачны крытэр: 21/21 + кансоль чыстая + пасля рэлоаду §-прагрэс і ўзроўні тыя ж.

---

## 8. Па-за межамі гэтага дакумента

* Генератары (§-задачы), `window.SUBS`, `window.GEN_BY_SUB` — `generators.js`; тут толькі
  кантракт ключа.
* Візуал §-панэлі — `docs/design-sub.md`.
* Экраны і патокі — `docs/spec-sub.md`.
* Магчымая v4 (напрыклад, ELO-ўзровень або ўлік часу) не патрабуе змены ключоў `subs`:
  дадаюцца новыя палі ў запіс, старыя чытаюцца як ёсць.
