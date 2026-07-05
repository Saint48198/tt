-- =====================================================================
-- Seed cities for common wish-list destinations.
--
-- Safe to re-run: every insert is guarded with NOT EXISTS on
-- (LOWER(name), country_id[, state_id]) so duplicates are not created.
--
-- Also inserts:
--   * Faroe Islands (country) if missing
--   * Manitoba, British Columbia (Canada) and New York (USA) states
--     if missing
-- =====================================================================

BEGIN;

-- --------------------------------------------------------------
-- Country: Faroe Islands (not in default world-countries seed)
-- --------------------------------------------------------------
INSERT INTO countries (name, abbreviation, geo_map_id, lat, lng, slug, region)
SELECT 'Faroe Islands', 'FO', 'FRO', 62.0000, -6.7833, 'faroe-islands', 'Europe'
WHERE NOT EXISTS (
  SELECT 1 FROM countries WHERE LOWER(name) = LOWER('Faroe Islands')
);

-- --------------------------------------------------------------
-- States / provinces
-- --------------------------------------------------------------
INSERT INTO states (name, abbr, country_id)
SELECT 'Manitoba', 'MB', c.id
FROM countries c
WHERE LOWER(c.name) = LOWER('Canada')
  AND NOT EXISTS (
    SELECT 1 FROM states s
    WHERE s.country_id = c.id AND LOWER(s.name) = LOWER('Manitoba')
  );

INSERT INTO states (name, abbr, country_id)
SELECT 'British Columbia', 'BC', c.id
FROM countries c
WHERE LOWER(c.name) = LOWER('Canada')
  AND NOT EXISTS (
    SELECT 1 FROM states s
    WHERE s.country_id = c.id AND LOWER(s.name) = LOWER('British Columbia')
  );

INSERT INTO states (name, abbr, country_id)
SELECT 'New York', 'NY', c.id
FROM countries c
WHERE LOWER(c.name) = LOWER('United States')
  AND NOT EXISTS (
    SELECT 1 FROM states s
    WHERE s.country_id = c.id AND LOWER(s.name) = LOWER('New York')
  );

-- --------------------------------------------------------------
-- Cities
-- --------------------------------------------------------------

-- Helper pattern used for every city:
--   INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
--   SELECT '<name>', <lat>, <lng>,
--          (SELECT id FROM states WHERE ...),  -- or NULL
--          (SELECT id FROM countries WHERE LOWER(name) = LOWER('<country>')),
--          '<wiki_term>'
--   WHERE NOT EXISTS (
--     SELECT 1 FROM cities ci
--     JOIN countries co ON co.id = ci.country_id
--     WHERE LOWER(ci.name) = LOWER('<name>')
--       AND LOWER(co.name) = LOWER('<country>')
--   );

-- Zagreb, Croatia
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Zagreb', 45.8150, 15.9819, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Croatia')),
       'Zagreb'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Zagreb') AND LOWER(co.name) = LOWER('Croatia')
);

-- Oia, Greece
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Oia', 36.4614, 25.3755, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Greece')),
       'Oia,_Greece'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Oia') AND LOWER(co.name) = LOWER('Greece')
);

-- Bergen, Norway
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Bergen', 60.3913, 5.3221, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Norway')),
       'Bergen'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Bergen') AND LOWER(co.name) = LOWER('Norway')
);

-- Brisbane, Australia
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Brisbane', -27.4698, 153.0251, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Australia')),
       'Brisbane'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Brisbane') AND LOWER(co.name) = LOWER('Australia')
);

-- Winnipeg, Manitoba, Canada
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Winnipeg', 49.8951, -97.1384,
       (SELECT s.id FROM states s JOIN countries c ON c.id = s.country_id
         WHERE LOWER(s.name) = LOWER('Manitoba') AND LOWER(c.name) = LOWER('Canada')),
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Canada')),
       'Winnipeg'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Winnipeg') AND LOWER(co.name) = LOWER('Canada')
);

-- Cortona, Italy
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Cortona', 43.2745, 11.9855, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Italy')),
       'Cortona'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Cortona') AND LOWER(co.name) = LOWER('Italy')
);

-- Wanaka, New Zealand
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Wanaka', -44.7000, 169.1500, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('New Zealand')),
       'Wanaka'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Wanaka') AND LOWER(co.name) = LOWER('New Zealand')
);

-- Hanga Roa, Chile (Easter Island)
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Hanga Roa', -27.1500, -109.4333, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Chile')),
       'Hanga_Roa'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Hanga Roa') AND LOWER(co.name) = LOWER('Chile')
);

-- New York, New York, USA
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'New York', 40.7128, -74.0060,
       (SELECT s.id FROM states s JOIN countries c ON c.id = s.country_id
         WHERE LOWER(s.name) = LOWER('New York') AND LOWER(c.name) = LOWER('United States')),
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('United States')),
       'New_York_City'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('New York') AND LOWER(co.name) = LOWER('United States')
);

-- San Miguel de Allende, Mexico
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'San Miguel de Allende', 20.9153, -100.7439, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Mexico')),
       'San_Miguel_de_Allende'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('San Miguel de Allende') AND LOWER(co.name) = LOWER('Mexico')
);

-- Cartagena, Colombia
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Cartagena', 10.3910, -75.4794, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Colombia')),
       'Cartagena,_Colombia'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Cartagena') AND LOWER(co.name) = LOWER('Colombia')
);

-- Naxos Town, Greece
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Naxos Town', 37.1036, 25.3766, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Greece')),
       'Chora,_Naxos'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Naxos Town') AND LOWER(co.name) = LOWER('Greece')
);

-- Cascais, Portugal
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Cascais', 38.6968, -9.4215, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Portugal')),
       'Cascais'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Cascais') AND LOWER(co.name) = LOWER('Portugal')
);

-- Luang Prabang, Laos
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Luang Prabang', 19.8834, 102.1347, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Laos')),
       'Luang_Prabang'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Luang Prabang') AND LOWER(co.name) = LOWER('Laos')
);

-- Torshavn, Faroe Islands
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Tórshavn', 62.0080, -6.7900, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Faroe Islands')),
       'Tórshavn'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) IN (LOWER('Tórshavn'), LOWER('Torshavn'))
    AND LOWER(co.name) = LOWER('Faroe Islands')
);

-- Vancouver, British Columbia, Canada
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Vancouver', 49.2827, -123.1207,
       (SELECT s.id FROM states s JOIN countries c ON c.id = s.country_id
         WHERE LOWER(s.name) = LOWER('British Columbia') AND LOWER(c.name) = LOWER('Canada')),
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Canada')),
       'Vancouver'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Vancouver') AND LOWER(co.name) = LOWER('Canada')
);

-- Istanbul, Turkey
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Istanbul', 41.0082, 28.9784, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Turkey')),
       'Istanbul'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Istanbul') AND LOWER(co.name) = LOWER('Turkey')
);

-- Singapore, Singapore
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Singapore', 1.3521, 103.8198, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Singapore')),
       'Singapore'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Singapore') AND LOWER(co.name) = LOWER('Singapore')
);

-- Madrid, Spain
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Madrid', 40.4168, -3.7038, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Spain')),
       'Madrid'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Madrid') AND LOWER(co.name) = LOWER('Spain')
);

-- Mexico City, Mexico
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Mexico City', 19.4326, -99.1332, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Mexico')),
       'Mexico_City'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Mexico City') AND LOWER(co.name) = LOWER('Mexico')
);

-- Lisbon, Portugal
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Lisbon', 38.7223, -9.1393, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Portugal')),
       'Lisbon'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Lisbon') AND LOWER(co.name) = LOWER('Portugal')
);

-- Rio de Janeiro, Brazil
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Rio de Janeiro', -22.9068, -43.1729, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Brazil')),
       'Rio_de_Janeiro'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Rio de Janeiro') AND LOWER(co.name) = LOWER('Brazil')
);

-- Amsterdam, Netherlands
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Amsterdam', 52.3676, 4.9041, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Netherlands')),
       'Amsterdam'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Amsterdam') AND LOWER(co.name) = LOWER('Netherlands')
);

-- Berlin, Germany
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Berlin', 52.5200, 13.4050, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Germany')),
       'Berlin'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Berlin') AND LOWER(co.name) = LOWER('Germany')
);

-- Hong Kong, China
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Hong Kong', 22.3193, 114.1694, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('China')),
       'Hong_Kong'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Hong Kong') AND LOWER(co.name) = LOWER('China')
);

-- Buenos Aires, Argentina
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Buenos Aires', -34.6037, -58.3816, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Argentina')),
       'Buenos_Aires'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Buenos Aires') AND LOWER(co.name) = LOWER('Argentina')
);

-- Melbourne, Australia
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Melbourne', -37.8136, 144.9631, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Australia')),
       'Melbourne'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Melbourne') AND LOWER(co.name) = LOWER('Australia')
);

-- Barcelona, Spain
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Barcelona', 41.3851, 2.1734, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Spain')),
       'Barcelona'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Barcelona') AND LOWER(co.name) = LOWER('Spain')
);

-- London, England (United Kingdom)
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'London', 51.5074, -0.1278, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('United Kingdom')),
       'London'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('London') AND LOWER(co.name) = LOWER('United Kingdom')
);

-- Sydney, Australia
INSERT INTO cities (name, lat, lng, state_id, country_id, wiki_term)
SELECT 'Sydney', -33.8688, 151.2093, NULL,
       (SELECT id FROM countries WHERE LOWER(name) = LOWER('Australia')),
       'Sydney'
WHERE NOT EXISTS (
  SELECT 1 FROM cities ci JOIN countries co ON co.id = ci.country_id
  WHERE LOWER(ci.name) = LOWER('Sydney') AND LOWER(co.name) = LOWER('Australia')
);

COMMIT;

-- =====================================================================
-- Verify
-- =====================================================================
-- SELECT ci.name, s.name AS state, co.name AS country, ci.lat, ci.lng, ci.wiki_term
-- FROM cities ci
-- LEFT JOIN states s ON s.id = ci.state_id
-- JOIN countries co ON co.id = ci.country_id
-- WHERE ci.name IN (
--   'Zagreb','Oia','Bergen','Brisbane','Winnipeg','Cortona','Wanaka','Hanga Roa',
--   'New York','San Miguel de Allende','Cartagena','Naxos Town','Cascais',
--   'Luang Prabang','Tórshavn','Vancouver','Istanbul','Singapore','Madrid',
--   'Mexico City','Lisbon','Rio de Janeiro','Amsterdam','Berlin','Hong Kong',
--   'Buenos Aires','Melbourne','Barcelona','London','Sydney'
-- )
-- ORDER BY co.name, ci.name;


