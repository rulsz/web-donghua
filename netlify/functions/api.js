const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// 1. Endpoint Katalog Donghua / Anime (Menggunakan Consumer API Public yang Stabil)
app.get('/api/list', async (req, res) => {
  try {
    // Mengambil daftar anime/donghua terpopuler/terbaru dari API Consumet
    const response = await axios.get('https://api.consumet.org/anime/gogoanime/top-airing', {
      timeout: 8000
    });

    const results = response.data.results || [];
    const donghuaList = results.map(item => ({
      title: item.title,
      href: item.id, // ID untuk mencari episode
      poster: item.image
    }));

    res.json({ success: true, data: donghuaList });
  } catch (error) {
    // Fallback jika API utama busy: Gunakan Jikan API (MyAnimeList)
    try {
      const fallback = await axios.get('https://api.jikan.moe/v4/seasons/now?limit=24', { timeout: 8000 });
      const items = fallback.data.data || [];
      const donghuaList = items.map(item => ({
        title: item.title,
        href: item.mal_id.toString(),
        poster: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url
      }));

      res.json({ success: true, data: donghuaList });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Gagal mengambil data dari server API.' });
    }
  }
});

// 2. Endpoint Stream Player Episode
app.get('/api/episode', async (req, res) => {
  try {
    const id = req.query.url;
    if (!id) return res.status(400).json({ error: 'ID episode diperlukan' });

    // Mencari info streaming dari Consumet API
    try {
      const infoRes = await axios.get(`https://api.consumet.org/anime/gogoanime/info/${id}`, { timeout: 8000 });
      const episodes = infoRes.data.episodes || [];
      
      if (episodes.length > 0) {
        const epId = episodes[0].id; // Ambil episode 1
        const streamRes = await axios.get(`https://api.consumet.org/anime/gogoanime/watch/${epId}`, { timeout: 8000 });
        const iframeSrc = streamRes.data.headers?.Referer || streamRes.data.sources[0]?.url;

        return res.json({
          success: true,
          servers: [{ name: 'Server Utama', iframe: iframeSrc }]
        });
      }
    } catch (e) {}

    // Fallback embed universal
    res.json({
      success: true,
      servers: [{ name: 'Server Alternative', iframe: `https://vidsrc.to/embed/anime/${id}` }]
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports.handler = serverless(app);
