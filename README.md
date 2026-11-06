# Noodlanding

Multiplayer astronaut-ontsnappingsspel in de browser — 3D met retro pixel-look (three.js), co-op tot 4 spelers via PeerJS. Draait volledig op GitHub Pages, geen eigen server nodig.

## Spelen
- Open `index.html` via GitHub Pages (Settings → Pages → branch `main`, map `/`).
- **Spelen / hosten** → kies een hoofdstuk. Met "Open voor vrienden" krijg je een code van 4 tekens.
- Vrienden kiezen **Meedoen met code**.

## Verhaal
1. **De Woestenij** — vind 3 zekeringen, draai de leidingen bij de generator → tempelpoort open. Kluiswapen: *Boogontlader* → baas *Schrootcolossus*.
2. **De Radioactieve Jungle** — zuurstofmasker nodig. 3 drukplaten tegelijk onder druk (spelers of kratten) terwijl golven aanvallen. Kluiswapen: *Sporenbrander* → baas *Moederplant*.
3. **De Vulkanische Breuk** — hittebeplating nodig, plasma aanbevolen. Runeplaten in de kleurvolgorde van de obelisk. Kluiswapen: *Sonische Resonator* → baas *Magma Leviathan*.
4. **De Ontsnapping** — repareer het schip met de 3 scheepsonderdelen + materialen uit de gedeelde opslag, overleef 90 s lanceersequentie.

Bazen zijn immuun tot hun pantser gebroken is met het unieke kluiswapen van die zone (Orbital Strike breekt er ook doorheen).

## Systemen
- **Core stats** STR / STA / INT (+3 per niveau).
- **Passief**: oneindig doorlevelen met grondstoffen.
- **Actief**: max. 3 uitgerust, elk 3 stapelbare upgradesporen (multipliers).
- **Ultiem**: vrijgespeeld door stat-combinaties (Titan Overdrive 40 STR/40 STA, Orbital Strike 50 INT/30 STA, Stormroeper 35 STR/35 INT, Feniks-protocol 45 STA/35 INT).
- **Wapensynergie**: Cryo bevriest → Plasma verbrijzelt (×2,5).
- **Basis bouwen**: wapenbank, pakstation, gedeelde opslag, munitiefabriek, geschuttoren, medstation.
- **Saves**: elke speler heeft een eigen savegame (localStorage, export/import in Instellingen). De host bezit het verhaal. Autosave elke 20 s. Bij het eerste betreden van een hoofdstuk wordt een snapshot gemaakt; herhalen gebruikt die snapshot en laat je hoofd-save ongemoeid.

## Besturing
WASD lopen · Shift sprint · muis richten/schieten · rechts/Z melee · Q F G vaardigheden · R ultiem · 1/2/X wapen · E gebruiken · Tab upgrades · B bouwen · M kaart · **V camera (top-down / 3e persoon / first person)** · **scrollwiel of + − zoomen**. Controller wordt ondersteund.

## Bestanden
`lib/` bevat three.js r128 en PeerJS 1.5.4 (lokaal meegeleverd). Code staat in `js/`.
