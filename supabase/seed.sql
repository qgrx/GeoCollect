-- ═══════════════════════════════════════════════════════════
-- GeoCards — Données initiales (seed)
-- Coller dans Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════

-- ─── Cartes principales ────────────────────────────────────
insert into public.cards (name, type, rarity, description, sellable, min_price, active) values
  ('Flamousse', 'Feu', 'rare', 'Embrase tout sur son passage.', true, NULL, true),
  ('Glaglaon', 'Glace', 'commun', 'Plus froide qu''un lundi matin.', true, NULL, true),
  ('Voltix', 'Foudre', 'épique', 'Court plus vite que son ombre.', true, NULL, true),
  ('Verdania', 'Nature', 'commun', 'Fait pousser des fleurs en dansant.', true, NULL, true),
  ('Aquarella', 'Eau', 'rare', 'Nage à travers les rêves.', true, NULL, true),
  ('Terrocaille', 'Terre', 'commun', 'Solide comme un château en béton.', true, NULL, true),
  ('Ventrax', 'Poison', 'rare', 'Son sourire cache toujours quelque chose.', true, NULL, true),
  ('Psychovide', 'Psy', 'légendaire', 'Peut lire dans tes pensées.', false, NULL, true),
  ('Soufflon', 'Air', 'commun', 'Invisible mais partout.', true, NULL, true),
  ('Dracolumière', 'Dragon', 'légendaire', 'Le boss final de toutes les histoires.', false, NULL, true),
  ('Féérock', 'Fée', 'épique', 'Adorable mais dangereuse.', true, 30, true),
  ('Ténébrax', 'Ombre', 'épique', 'N''existe que dans le noir.', true, NULL, true),
  ('Cailloudou', 'Terre', 'commun', 'Petit mais têtu comme dix mules.', true, NULL, true),
  ('Luminos', 'Lumière', 'rare', 'Brille même seul.', true, NULL, true),
  ('Fuméroule', 'Feu', 'commun', 'Plus impressionnant en rêve.', true, NULL, true),
  ('Gorfoutre', 'Eau', 'commun', 'Adore barboter.', true, NULL, true),
  ('Zappeur', 'Foudre', 'rare', 'Toujours là au mauvais moment.', true, NULL, true),
  ('Rosépine', 'Nature', 'épique', 'Belle comme une rose, piquante.', true, NULL, true);

-- ─── Cartes Achievement ────────────────────────────────────
insert into public.cards (name, type, rarity, description, sellable, active) values
  ('Premier Log', 'Achievement', 'commun', 'Ta toute première carte gagnée !', false, true),
  ('Collectionneur', 'Achievement', 'rare', '5 cartes dans ta collection.', false, true),
  ('Premier Achat', 'Achievement', 'commun', 'Ton premier achat sur le marché.', false, true),
  ('Acheteur', 'Achievement', 'rare', '10 achats sur le marché.', false, true),
  ('Gros Acheteur', 'Achievement', 'épique', '100 achats sur le marché.', false, true),
  ('Premier Vendeur', 'Achievement', 'commun', 'Ta première vente sur le marché.', false, true),
  ('Vendeur', 'Achievement', 'rare', '10 ventes réalisées.', false, true),
  ('Grand Vendeur', 'Achievement', 'épique', '100 ventes réalisées.', false, true),
  ('Legendaire', 'Achievement', 'légendaire', 'Tu possèdes ta première carte légendaire.', false, true),
  ('Endurant', 'Achievement', 'rare', '10 cartes gagnées en une seule journée.', false, true),
  ('Fidèle', 'Achievement', 'épique', '1 carte trouvée par jour pendant 7 jours.', false, true);

-- ─── Questions géocaching ──────────────────────────────────
insert into public.questions (question, answer, hint, active) values
  ('Comment appelle-t-on le carnet de bord physique dans une cache ?', 'logbook', 'On y signe sa visite', true),
  ('Que signifie la lettre T dans le système D/T ?', 'terrain', 'D = Difficulté, T = ?', true),
  ('Quel objet voyage de cache en cache avec un code de suivi unique ?', 'trackable', 'TB ou géocoin', true),
  ('Comment appelle-t-on une visite infructueuse ?', 'DNF', 'Did Not Find', true),
  ('Quel type de cache nécessite de résoudre une énigme avant de chercher ?', 'mystère', 'Icône ? sur la carte', true),
  ('Comment nomme-t-on la petite boite cylindrique sous un banc ?', 'tube bison', 'Cylindrique et magnétique', true),
  ('Quelle lettre désigne la coordonnée Nord dans un waypoint ?', 'N', 'N 48° 51.500', true),
  ('Que signifie l''acronyme CITO en géocaching ?', 'cache in trash out', 'Événement écologique', true),
  ('Quel site a lancé le géocaching en l''an 2000 ?', 'geocaching.com', 'Le plus grand site mondial', true),
  ('Comment appelle-t-on le propriétaire d''une cache en abrégé ?', 'CO', 'Cache Owner', true),
  ('Combien de minutes dans un degré de latitude ?', '60', 'Subdivisions d''un degré', true),
  ('Quel outil de navigation est indispensable pour trouver une cache ?', 'GPS', 'Satellite-based', true),
  ('Comment appelle-t-on les objets laissés dans une cache pour être échangés ?', 'swag', 'On laisse si on prend', true),
  ('Quel est le grade maximum du système D/T ?', '5', 'De 1 à ?', true),
  ('Quel format de coordonnées est standard sur geocaching.com ?', 'degrés décimaux', 'DD MM.MMM', true),
  ('Comment appelle-t-on une cache dont les coordonnées sont exactes et directes ?', 'cache traditionnelle', 'Icône verte sur la carte', true),
  ('Quelle abréviation signifie Trouvé Il Y A en géocaching francophone ?', 'TFTC', 'Thanks For The Cache', true),
  ('Quelle est la taille minimale d''une nano-cache ?', 'nano', 'Plus petit qu''un ongle', true);

-- ─── Vérification ──────────────────────────────────────────
select 'cards' as table_name, count(*) from public.cards
union all
select 'questions', count(*) from public.questions;