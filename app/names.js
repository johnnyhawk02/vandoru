// VANDORU: patch and sound names. New words jumbled out of pieces of real ones: the start of one word, sometimes the middle of
// a second, and the end of another, joined where a vowel meets a consonant so the result can be said out loud
// ("QUANDALF", "NEBULOKI", "ZORVATRON GIMLAR"). The start and the end always come from two different lists, so
// every name is a mix of themes. No UI here.
//
// To add a theme, add a list to WORDS (lower case, letters only, no word that another list has): every list is used.
export const WORDS = {
  space: ['nebula', 'quasar', 'pulsar', 'galaxy', 'comet', 'meteor', 'asteroid', 'orbit', 'planet', 'cosmos', 'stellar', 'lunar', 'solar',
    'nova', 'supernova', 'eclipse', 'zenith', 'apogee', 'perigee', 'aphelion', 'perihelion', 'equinox', 'solstice', 'satellite', 'rocket',
    'capsule', 'booster', 'gantry', 'telemetry', 'trajectory', 'parallax', 'parsec', 'redshift', 'singularity', 'wormhole', 'horizon',
    'corona', 'photosphere', 'magnetar', 'protostar', 'cluster', 'constellation', 'andromeda', 'orion', 'cassiopeia', 'sirius', 'vega',
    'altair', 'deneb', 'rigel', 'betelgeuse', 'antares', 'arcturus', 'polaris', 'mercury', 'venus', 'jupiter', 'saturn', 'uranus', 'neptune',
    'pluto', 'titan', 'europa', 'ganymede', 'callisto', 'triton', 'phobos', 'deimos', 'ceres', 'kuiper', 'heliopause', 'magnetosphere',
    'ionosphere', 'aurora', 'zodiac', 'celestial', 'astral', 'sidereal', 'galactic', 'interstellar', 'voyager', 'pioneer', 'apollo',
    'sputnik', 'soyuz', 'cosmonaut', 'astronaut', 'telescope', 'observatory', 'umbra', 'penumbra', 'albedo', 'azimuth', 'nadir', 'syzygy',
    'transit', 'occultation', 'libration', 'ecliptic', 'meridian', 'lagrange', 'perseid', 'pleiades', 'centauri', 'proxima', 'halley',
    'cygnus', 'draco', 'lyra', 'aquila', 'pegasus', 'hydra', 'carina', 'vela', 'corvus', 'gemini', 'taurus', 'scorpius', 'ophiuchus',
    'enceladus', 'oberon', 'titania', 'miranda', 'ariel', 'charon', 'eris', 'makemake', 'sedna', 'vesta', 'pallas', 'lander', 'rover',
    'module', 'docking', 'reentry', 'payload', 'thruster', 'nozzle', 'gimbal', 'apsis', 'periapsis', 'apoapsis', 'bolide', 'tektite'],
  physics: ['quantum', 'photon', 'electron', 'proton', 'neutron', 'quark', 'lepton', 'boson', 'gluon', 'muon', 'neutrino', 'hadron',
    'fermion', 'meson', 'baryon', 'positron', 'graviton', 'tachyon', 'plasma', 'entropy', 'enthalpy', 'inertia', 'momentum', 'velocity',
    'vector', 'tensor', 'scalar', 'kinetic', 'potential', 'voltage', 'current', 'ampere', 'farad', 'tesla', 'weber', 'joule', 'newton',
    'pascal', 'kelvin', 'hertz', 'coulomb', 'candela', 'lumen', 'flux', 'resonance', 'harmonic', 'oscillator', 'frequency', 'amplitude',
    'wavelength', 'interference', 'diffraction', 'refraction', 'reflection', 'polarization', 'spectrum', 'laser', 'maser', 'magnet',
    'dipole', 'monopole', 'solenoid', 'capacitor', 'inductor', 'resistor', 'diode', 'transistor', 'cathode', 'anode', 'isotope', 'nucleus',
    'fission', 'fusion', 'radiation', 'gamma', 'lambda', 'sigma', 'omega', 'delta', 'theta', 'epsilon', 'planck', 'fermi', 'dirac',
    'higgs', 'pauli', 'doppler', 'kepler', 'lorentz', 'maxwell', 'faraday', 'torque', 'friction', 'gravity', 'relativity', 'spacetime',
    'entanglement', 'superposition', 'uncertainty', 'symmetry', 'parity', 'viscosity', 'turbulence', 'vortex', 'thermal', 'adiabatic',
    'isotropic', 'cryogenic', 'superfluid', 'condensate', 'lattice', 'crystal', 'phonon', 'exciton', 'plasmon', 'soliton', 'chaos',
    'fractal', 'attractor', 'manifold', 'photonic', 'kinematic', 'ballistic', 'elastic', 'impulse', 'pendulum', 'gyroscope', 'cyclotron',
    'synchrotron', 'collider', 'calorimeter', 'interferometer', 'hologram', 'emission', 'absorption', 'ionization', 'valence', 'orbital',
    'eigenstate', 'hamiltonian', 'lagrangian', 'vacuum', 'ether', 'quintessence', 'antimatter', 'darkmatter', 'curvature', 'geodesic'],
  tolkien: ['gandalf', 'aragorn', 'legolas', 'gimli', 'frodo', 'samwise', 'meriadoc', 'peregrin', 'boromir', 'faramir', 'denethor', 'theoden',
    'eowyn', 'eomer', 'galadriel', 'celeborn', 'elrond', 'arwen', 'saruman', 'sauron', 'gollum', 'smeagol', 'bilbo', 'thorin', 'balin', 'dwalin',
    'fili', 'kili', 'gloin', 'bifur', 'bofur', 'bombur', 'dori', 'nori', 'smaug', 'beorn', 'radagast', 'treebeard', 'bombadil', 'goldberry',
    'glorfindel', 'isildur', 'elendil', 'anarion', 'earendil', 'luthien', 'beren', 'feanor', 'fingolfin', 'finrod', 'turin', 'hurin', 'morgoth',
    'melkor', 'ungoliant', 'shelob', 'grima', 'haldir', 'thranduil', 'gothmog', 'shagrat', 'gorbag', 'ugluk', 'azog', 'elros', 'cirdan',
    'celebrimbor', 'thingol', 'melian', 'tuor', 'idril', 'maeglin', 'turgon', 'fingon', 'maedhros', 'maglor', 'galdor', 'erestor', 'halbarad',
    'imrahil', 'beregond', 'erkenbrand', 'gamling', 'theodred', 'shadowfax', 'lobelia', 'butterbur', 'elanor', 'manwe', 'varda', 'ulmo', 'yavanna',
    'mandos', 'nienna', 'orome', 'tulkas', 'elbereth', 'ancalagon', 'glaurung', 'carcharoth', 'thorondor', 'gwaihir', 'quickbeam', 'fangorn',
    'baggins', 'gamgee', 'brandybuck', 'tinuviel', 'undomiel', 'mithrandir', 'elessar', 'strider', 'amroth', 'nimrodel', 'finduilas', 'morwen',
    'nienor', 'beleg', 'mablung', 'ecthelion', 'barliman', 'fredegar', 'durin', 'thrain', 'girion', 'elwing', 'celegorm', 'caranthir', 'curufin',
    'finarfin', 'aredhel', 'orodreth', 'gwindor', 'voronwe', 'arathorn', 'gilraen', 'mordor', 'gondor', 'rohan', 'rivendell', 'lothlorien', 'moria',
    'isengard', 'erebor', 'mirkwood', 'numenor', 'valinor', 'beleriand', 'gondolin', 'doriath', 'nargothrond', 'angband', 'orthanc', 'edoras',
    'osgiliath', 'ithilien', 'anduin', 'tirith', 'morgul', 'eriador', 'arnor', 'harad', 'hobbiton', 'caradhras', 'mithril', 'palantir', 'silmaril',
    'nazgul', 'balrog', 'istari', 'dunedain', 'rohirrim', 'noldor', 'sindar', 'teleri', 'valar', 'maiar', 'ainur', 'anduril', 'narsil', 'glamdring',
    'orcrist', 'galadhrim', 'imladris'],
  fantasy: ['dragon', 'wizard', 'sorcerer', 'warlock', 'goblin', 'griffin', 'phoenix', 'unicorn', 'basilisk', 'wyvern', 'chimera', 'kraken', 'golem',
    'gargoyle', 'paladin', 'druid', 'ranger', 'necromancer', 'enchanter', 'conjurer', 'alchemist', 'talisman', 'amulet', 'grimoire', 'cauldron',
    'potion', 'scepter', 'excalibur', 'avalon', 'camelot', 'merlin', 'morgana', 'lancelot', 'guinevere', 'percival', 'galahad', 'pendragon',
    'tintagel', 'lyonesse', 'rune', 'sigil', 'spectre', 'wraith', 'banshee', 'ogre', 'troll', 'gnome', 'pixie', 'sprite', 'dryad', 'nymph', 'centaur',
    'minotaur', 'cyclops', 'leviathan', 'behemoth', 'manticore', 'salamander', 'homunculus', 'citadel', 'dungeon', 'labyrinth', 'catacomb', 'bastion',
    'rampart', 'gauntlet', 'halberd', 'scimitar', 'rapier', 'claymore', 'longbow', 'quiver', 'chalice', 'grail', 'oracle', 'prophecy', 'incantation',
    'enchantment', 'sorcery', 'arcane', 'mystic', 'ethereal', 'eldritch', 'tempest', 'thunder', 'ember', 'obsidian', 'moonstone', 'changeling',
    'werewolf', 'revenant', 'kobold', 'djinn', 'ifrit', 'valkyrie', 'berserker', 'barbarian', 'minstrel', 'bard', 'jester', 'squire', 'knight',
    'baron', 'kingdom', 'realm', 'throne', 'scroll', 'codex', 'relic', 'portal', 'abyss', 'faerie', 'elven', 'dwarven', 'runic', 'hippogriff',
    'selkie', 'kelpie', 'leprechaun', 'boggart', 'phantom', 'magus', 'shaman', 'enchantress', 'sorceress', 'elemental', 'treant', 'drake', 'wyrm',
    'serpent', 'lindworm', 'thunderbird', 'simurgh', 'kitsune', 'tengu', 'mandrake', 'wolfsbane', 'nightshade', 'belladonna', 'starlight', 'twilight',
    'emerald', 'sapphire', 'topaz', 'opal', 'amethyst', 'garnet', 'jasper', 'adamant', 'orichalcum', 'portcullis', 'battlement', 'turret', 'heraldry',
    'bestiary', 'familiar', 'apprentice', 'sellsword', 'wayfarer', 'moonwell', 'spellbook', 'dragonfly', 'stormcaller', 'frostfell', 'ironwood',
    'silverthorn'],
  alien: ['zorvak', 'xelthar', 'vexlor', 'klytos', 'zyphon', 'thraxis', 'qelmar', 'vornax', 'xandrel', 'zuvika', 'kryvan', 'ulthex', 'ixolar',
    'yzmora', 'drakzul', 'nexuvi', 'omkara', 'zentari', 'vulkora', 'kazimu', 'xiloten', 'azquil', 'thuvian', 'glixar', 'mokvar', 'zelnik', 'jaxuri',
    'qivara', 'oxulon', 'blorvex', 'zintaru', 'kelvaxi', 'xathura', 'vyrkon', 'zabriko', 'zarnok', 'uvelix', 'ghorzan', 'plaxido', 'zemvolu',
    'axitoru', 'vozhan', 'zogluma', 'xerphon', 'kitharu', 'nuvexa', 'orzaku', 'pyxolan', 'qotheru', 'raxmul', 'syzarin', 'tolvexi', 'ubrixa',
    'varkuna', 'wexlion', 'xomari', 'yevlok', 'zhurani', 'aqvelon', 'bryzeth', 'ekthari', 'fluxano', 'hyxura', 'izvoran', 'jorquil', 'kavanthu',
    'luxorim', 'nyktari', 'oqtavis', 'klaatu', 'barada', 'nikto', 'vogon', 'dalek', 'xenomorph', 'tribble', 'gallifrey', 'arrakis', 'solaris',
    'xenon', 'krypton', 'zircon', 'axolotl', 'quetzal', 'zephyr', 'onyx', 'xylem', 'zygote', 'quixotic', 'xanadu', 'zanzibar', 'glimmox', 'quibblo',
    'wobblix', 'zizzle', 'froonk', 'gloopo', 'meeblax', 'noodlix', 'plonkari', 'squonk', 'zwibble', 'yoblix', 'bopzul', 'doozan', 'fizzlot',
    'grooblex', 'hoopzar', 'jibblon', 'kwazoo', 'loombix', 'zeeblo', 'glorpax', 'vrelliko', 'tazmuri', 'xinthea', 'ozkavi', 'mubaru', 'qwillon',
    'skavoon', 'threlzu', 'ulquorra', 'velquin', 'yxandro', 'zomblit', 'krellix', 'pandoru', 'quazzit', 'rilkoon', 'snazgu', 'tivvax', 'umbloo',
    'wizlar', 'xaboo', 'yorblit', 'zuzzle', 'bleepo', 'gorvash', 'hixxen', 'jazoon', 'klomper', 'lumzi', 'mixxul', 'nargle', 'orbizu',
    'pluxxa', 'quorbi'],
  myth: ['zeus', 'hera', 'athena', 'artemis', 'hermes', 'poseidon', 'hades', 'persephone', 'demeter', 'dionysus', 'hephaestus', 'ares', 'aphrodite',
    'prometheus', 'atlas', 'hyperion', 'cronus', 'gaia', 'helios', 'selene', 'hecate', 'nemesis', 'morpheus', 'hypnos', 'thanatos', 'cerberus',
    'medusa', 'perseus', 'theseus', 'achilles', 'odysseus', 'hercules', 'icarus', 'daedalus', 'orpheus', 'eurydice', 'pandora', 'odin', 'thor',
    'loki', 'freya', 'frigg', 'baldur', 'heimdall', 'fenrir', 'yggdrasil', 'valhalla', 'asgard', 'midgard', 'ragnarok', 'bifrost',
    'sleipnir', 'osiris', 'isis', 'anubis', 'horus', 'thoth', 'sekhmet', 'bastet', 'amun', 'gilgamesh', 'enkidu', 'ishtar', 'marduk', 'tiamat',
    'quetzalcoatl', 'kukulkan', 'tlaloc', 'ixchel', 'viracocha', 'morrigan', 'dagda', 'brigid', 'cernunnos', 'taliesin', 'ceridwen', 'rhiannon',
    'arawn', 'perun', 'veles', 'svarog', 'sphinx', 'harpy', 'gorgon', 'nereid', 'naiad', 'satyr', 'calypso', 'circe', 'penelope', 'telemachus',
    'agamemnon', 'menelaus', 'hector', 'priam', 'cassandra', 'ajax', 'nestor', 'jason', 'medea', 'argonaut', 'olympus', 'elysium', 'tartarus', 'styx',
    'lethe', 'acheron', 'arcadia', 'atlantis', 'delphi', 'ithaca', 'sparta', 'hesperides', 'chiron', 'echo', 'narcissus', 'midas', 'sisyphus',
    'tantalus', 'bellerophon', 'ariadne', 'minos', 'pasiphae', 'electra', 'antigone', 'oedipus', 'tiresias', 'proteus', 'nereus', 'oceanus', 'tethys',
    'rhea', 'themis', 'mnemosyne', 'calliope', 'clio', 'erato', 'euterpe', 'terpsichore', 'thalia', 'urania', 'selkath', 'skadi', 'idun',
    'bragi', 'vidar', 'hermod', 'sif', 'nidhogg', 'huginn', 'muninn', 'jotunheim', 'muspelheim', 'vanaheim',
    'sobek', 'khonsu', 'hathor', 'nephthys', 'anhur', 'enlil', 'enki', 'inanna', 'nergal', 'ereshkigal', 'utnapishtim'],
};

const isVowel = (w, i) => 'aeiouy'.includes(w[i]) && !(w[i] === 'y' && i === 0) && !(w[i] === 'u' && w[i - 1] === 'q');
/** a word as runs of consonants and vowels in turn: "quasar" -> ['qu', 'a', 's', 'a', 'r'] ("qu" is one consonant
 *  sound, and a y that starts a word is a consonant), each { text, vowel } */
export function runs(word) {
  const out = [];
  for (let i = 0; i < word.length; i++) {
    const vowel = isVowel(word, i), last = out[out.length - 1];
    if (last && last.vowel === vowel) last.text += word[i]; else out.push({ text: word[i], vowel });
  }
  return out;
}
/** the pieces a word gives: heads (its start, up to and including a vowel run), middles (from a consonant run to a
 *  vowel run inside it) and tails (from a consonant run to its end). Every piece has a consonant and a vowel in it, and
 *  none is the whole word */
export function pieces(word) {
  const r = runs(word), join = (a, b) => r.slice(a, b).map((x) => x.text).join(''), heads = [], mids = [], tails = [];
  for (let i = 0; i < r.length; i++) {
    if (r[i].vowel && i > 0 && i < r.length - 1) { const h = join(0, i + 1); if (h.length >= 2 && h.length <= 5) heads.push(h); } // (with a consonant in it)
    if (!r[i].vowel && i > 0) {
      const t = join(i, r.length); if (i < r.length - 1 && t.length >= 2 && t.length <= 6) tails.push(t); // (with a vowel in it)
      for (let j = i + 1; j < r.length - 1; j++) if (r[j].vowel) { const m = join(i, j + 1); if (m.length >= 2 && m.length <= 4) mids.push(m); }
    }
  }
  return { heads, mids, tails };
}

const BLOCKED = ['fuck', 'shit', 'cunt', 'cock', 'dick', 'piss', 'anus', 'rape', 'nazi', 'slut', 'whor', 'fag', 'nig', 'wank', 'twat', 'porn', 'sex', 'jiz', 'coon', 'spic', 'kike',
  'crap', 'arse', 'turd', 'pedo', 'boob', 'tits', 'puke', 'scum', 'hitler', 'penis', 'vagin', 'homo', 'poop', 'bitch'];
const sayable = (w) => !/(.)\1\1/.test(w) && !BLOCKED.some((b) => w.includes(b));
const pick = (a, rng) => a[Math.floor(rng() * a.length)];
let cache = null;
// every list's words (one copy of each) as pieces, each piece with the list it came from; built again if WORDS was
// given another theme
function pool(lists) {
  const names = Object.keys(lists), n = names.reduce((a, k) => a + lists[k].length, 0);
  if (cache && cache.lists === lists && cache.n === n && cache.themes === names.length) return cache;
  const words = new Set(), heads = [], mids = [], tails = [];
  names.forEach((k, t) => { for (const raw of lists[k]) {
    const w = String(raw).toLowerCase().replace(/[^a-z]/g, '');
    if (w.length < 3 || words.has(w)) continue;
    words.add(w);
    const p = pieces(w);
    for (const x of p.heads) heads.push([x, t]); for (const x of p.mids) mids.push([x, t]); for (const x of p.tails) tails.push([x, t]);
  } });
  return (cache = { lists, n, themes: names.length, names, words, heads, mids, tails });
}
/** one new word of min..max letters and the lists its pieces came from, { word, from: [list of the start, (of the
 *  middle,) of the end] }: a start, now and then a middle, and an end. The start and the end are from two different
 *  lists (when there are two), and the word is never one of the lists' own */
export function spliced(rng = Math.random, min = 5, max = 10, lists = WORDS) {
  const p = pool(lists);
  for (let n = 0; n < 600; n++) {
    const h = pick(p.heads, rng), m = rng() < 0.3 ? pick(p.mids, rng) : null, t = pick(p.tails, rng), w = h[0] + (m ? m[0] : '') + t[0];
    if ((p.themes < 2 || t[1] !== h[1]) && w.length >= min && w.length <= max && !p.words.has(w) && sayable(w)) return { word: w, from: [h, m, t].filter(Boolean).map((x) => p.names[x[1]]) };
  }
  const t = pick(p.tails, rng); return { word: 'nova' + t[0], from: [p.names[0], p.names[t[1]]] }; // (never reached with the lists as they are)
}
/** one new word of min..max letters (see spliced) */
export const jumble = (rng = Math.random, min = 5, max = 10, lists = WORDS) => spliced(rng, min, max, lists).word;
/** a preset name in capitals: one word, or two shorter ones; not one of taken (a Set of names in use) */
export function presetName(rng = Math.random, taken = new Set(), lists = WORDS) {
  for (let n = 0; n < 50; n++) {
    const name = (rng() < 0.55 ? jumble(rng, 6, 10, lists) : jumble(rng, 4, 7, lists) + ' ' + jumble(rng, 4, 7, lists)).toUpperCase();
    if (!taken.has(name)) return name;
  }
  return jumble(rng, 6, 10, lists).toUpperCase() + ' ' + (taken.size + 1);
}
