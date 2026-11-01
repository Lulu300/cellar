-- From 1.4.0 each wine colour has a colour value (FEAT-03). Migration 0018 gave every row the
-- neutral grey; the seeded colours get theirs here, found by their name as startingHex in
-- src/lib/shared/wine-colors.ts finds it, written out because a migration must not change when the
-- code does: case and blanks do not count, nor the accent of Rosé (SQLite's lower() leaves accented
-- letters as they are), and the English names cover a seeded row that the user translated. Any
-- other colour keeps the grey until the user picks one in the admin.
UPDATE `wine_colors`
SET `hex` = CASE replace(replace(lower(trim(`color`)), 'é', 'e'), 'É', 'e')
    WHEN 'rouge' THEN '#7b1e2b'
    WHEN 'red' THEN '#7b1e2b'
    WHEN 'blanc' THEN '#ead98b'
    WHEN 'white' THEN '#ead98b'
    WHEN 'rose' THEN '#f2a08c'
    WHEN 'jaune' THEN '#d4952a'
    WHEN 'yellow' THEN '#d4952a'
    ELSE `hex`
END;
