const UA_LIST = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15',
  'Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/125.0',
];

export const NPC_LIST = [
  'Zéphyr','Luna','Rox','Skyla','Torben','Mireille','Axo','Penpen','Drakko','Céleste',
  'Ourson','Vanya','Freki','Nimbus','Sirius','Boussole','Kairo','Tessie','Wrenley','Daxon',
  'Flint','Orla','Sable','Cosmo','Pippa','Dune','Rafale','Echo','Mako','Liora',
  'Pixel','Talon','Brume','Vesper','Crux','Solène','Drift','Myra','Blaze','Koda',
];

export const NPC_DATA = NPC_LIST.map((name, i) => ({
  name,
  email:  `${name.toLowerCase()}@geocards.io`,
  ip:     `${10 + (i % 200)}.${(i * 7) % 256}.${(i * 13) % 256}.${(i * 17 + 1) % 256}`,
  joined:   new Date(Date.now() - Math.random() * 90 * 864e5).toLocaleDateString('fr-FR'),
  lastSeen: new Date(Date.now() - Math.random() *  7 * 864e5).toLocaleDateString('fr-FR'),
  ua:     UA_LIST[i % UA_LIST.length],
  status: 'actif',
  pseudoHistory: [{ pseudo: name, date: new Date(Date.now() - Math.random() * 90 * 864e5).toLocaleDateString('fr-FR') }],
}));
