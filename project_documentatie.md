# BeatConvert (Media Converter Music & Video)

BeatConvert is een moderne Next.js webapplicatie waarmee gebruikers mediabestanden van populaire streamingdiensten en sociale mediaplatforms kunnen analyseren, converteren en downloaden naar verschillende audio- en videoformaten.

---

## 🚀 Belangrijkste Functies

### 1. Multi-Platform Link Detectie & Analyse
De applicatie herkent automatisch de herkomst van ingevoerde URL's en toont vóór het downloaden een preview (titel, artiest/auteur, duur en albumhoes/thumbnail).

Ondersteunde platforms:
* **YouTube** (`youtube.com`, `music.youtube.com`, `youtu.be`)
* **Spotify** (`spotify.com`, `open.spotify.com`)
* **SoundCloud** (`soundcloud.com`)
* **Bandcamp** (`bandcamp.com`)
* **Vimeo** (`vimeo.com`)
* **TikTok** (`tiktok.com`, `vm.tiktok.com`)
* **Instagram** (`instagram.com`, `instagr.am`)

### 2. Audio- & Videoconversie
* **Audioformaten:** 
  * `MP3` (instelbare bitrate: 128 kbps, 192 kbps of 320 kbps)
  * `WAV` (ongecomprimeerd)
  * `M4A` (AAC audio)
  * `FLAC` (lossless audio)
* **Videoformaten (voor ondersteunde videoplatforms):**
  * `MP4` (H.264 video)
  * `MPEG` (MPEG-2 video)
  * Instelbare resoluties: 360p, 480p, 720p, 1080p, 1440p en 2160p (4K).

### 3. Slimme Spotify Matching
Omdat Spotify-streams beveiligd zijn met DRM, gebruikt BeatConvert een matching-engine:
1. Haalt officiële trackmetadata (artiest, titel, tijdsduur) op via de Spotify Web API.
2. Zoekt automatisch naar een identieke publieke audiobron op YouTube of SoundCloud op basis van token-analyse en exacte tijdsduurovereenkomst.
3. Converteert en levert het bestand naadloos af onder de juiste tracknaam.

### 4. Gebruikerslimieten & Tier Systeem
Beheer van downloadlimieten via browsercookies (`mc-device-id`):
* **Gratis Gebruikers:**
  * Maximaal 3 videodownloads per dag (tot 720p).
  * Maximaal 20 standaardaudioconversies per dag (tot 192 kbps MP3).
* **Premium Gebruikers (`mc-premium-token`):**
  * Tot 20 videodownloads per dag inclusief 1080p en 4K.
  * Tot 100 high-quality audioconversies per maand (inclusief FLAC, WAV en 320 kbps MP3).

### 5. UI & Gebruikservaring
* **Dark / Light mode:** Omschakelen met automatische persistente opslag in localStorage.
* **Privacy & Cookie Consent:** Ingebouwde banner voor toestemming met lax-cookies.
* **Informatieve pagina's:** Inclusief kant-en-klare pagina's voor `/tutorial`, `/faq` en `/privacy`.
* **Advertentie-integratie:** Optionele advertentieslots (`AdSlot.tsx`) die dynamisch kunnen worden in- of uitgeschakeld.

---

## 🛠️ Technische Stack

* **Framework:** Next.js (App Router, React 19)
* **Styling:** Tailwind CSS v4 met CSS theme-variabelen
* **Media Processing:** 
  * `youtube-dl-exec` (`yt-dlp` wrapper)
  * `ffmpeg-static` & Node.js child processes
* **API Streaming:** Node.js stream pipeline naar Web Streams API (`ReadableStream`)

---

## ⚙️ Omgevingsvariabelen (`.env.local`)

Maak een `.env.local` bestand aan in de root directory met de volgende variabelen:

```env
# Spotify API (Vereist voor Spotify track matching)
SPOTIFY_CLIENT_ID=jouw_spotify_client_id
SPOTIFY_CLIENT_SECRET=jouw_spotify_client_secret

# Toegang & Limieten (Optioneel)
MEDIA_CONVERTER_PREMIUM_TOKEN=jouw_geheime_premium_token

# Advertenties (Optioneel)
NEXT_PUBLIC_ADS_ENABLED=false
```

---

## 📦 Installatie en Uitvoering

1. Installeer dependencies:
   ```bash
   npm install
   ```

2. Start de ontwikkelserver:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in je browser.