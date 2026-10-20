# Latih CPR — versi telefon (PWA)

Web app yang dibuka di browser telefon dan boleh dipasang di skrin utama seperti app biasa. AI pose (MediaPipe Pose Landmarker) berjalan **dalam telefon**; video tidak dihantar ke mana-mana. Selepas dibuka sekali dengan internet, app dan model disimpan untuk guna **luar talian**.

## Kandungan folder

| Fail | Fungsi |
|---|---|
| `index.html` | App: skrin persediaan, latihan (kamera + HUD), keputusan |
| `cpr-core.js` | Logik pengesanan kompresi, sesi, maklum balas (sama seperti versi Python) |
| `sw.js` | Simpan app + model untuk guna luar talian |
| `manifest.webmanifest`, `icon-*.png` | Membolehkan "Add to Home Screen" |

## Pasang di GitHub Pages (percuma, ~5 minit)

Kamera telefon hanya dibenarkan pada laman **https**, jadi app perlu dihost. GitHub Pages paling mudah.

1. Daftar/log masuk di github.com → **New repository** → nama: `latih-cpr` → *Public* → Create.
2. **Add file → Upload files** → seret semua fail dalam folder ini → **Commit changes**.
3. **Settings → Pages** → *Source*: `Deploy from a branch` → *Branch*: `main` / `(root)` → Save.
4. Tunggu 1–2 minit. Pautan: `https://<nama-pengguna>.github.io/latih-cpr/`
5. Buka pautan di telefon:
   - **Android (Chrome):** menu ⋮ → *Add to Home screen / Install app*
   - **iPhone (Safari):** butang Share → *Add to Home Screen*

## Cara guna

| Langkah | Perkara |
|---|---|
| 1 | Sandar telefon di **sisi** manikin, 1.5–2.5 m, mendatar (landskap). Guna stand/tripod. |
| 2 | Pastikan kepala, tangan dan pinggul kelihatan. |
| 3 | Tekan **Mula latihan** → benarkan kamera. |
| 4 | Letak tangan di dada manikin tanpa menekan 2 saat, kemudian mula kompresi. |
| 5 | Ikut bunyi metronom 110/min dan arahan suara. Tekan **Tamat** untuk keputusan. |

## Ciri-ciri

| Ciri | Butiran |
|---|---|
| Ukuran masa nyata | Kadar, kedalaman (anggaran), recoil, sudut siku, kiraan 30:2 |
| Metronom bunyi | 110/min, boleh on/off semasa latihan |
| Arahan suara | "Tekan lebih dalam", "Luruskan siku", "Tiga puluh, beri dua bantuan pernafasan" (guna suara Bahasa Melayu/Indonesia telefon jika ada) |
| Skrin kekal hidup | Wake Lock semasa latihan |
| Keputusan | Skor /100, jadual, ulasan jurulatih (dalam telefon), sasaran sesi seterusnya |
| Kongsi | Hantar ringkasan ke WhatsApp/e-mel |
| Sejarah | 20 sesi terakhir disimpan dalam telefon |

## Had

- Kedalaman ialah anggaran kamera 2D. Sahkan dengan manikin berpenunjuk kedalaman, kemudian laraskan "Panjang bahu → pinggul" dalam Tetapan.
- Kedudukan tangan di sternum belum disemak.
- Telefon lama mungkin perlahan (< 15 fps); ketepatan kadar menurun jika fps terlalu rendah.
- Alat bantu latihan sahaja, bukan pengganti kursus BLS bertauliah.
