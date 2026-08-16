const express = require('express');
const serverless = require('serverless-http');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// 1. Endpoint Katalog (Jikan API / MyAnimeList)
app.get('/api/list', async (req, res) => {
  try {
    // Mengambil anime/donghua terbaru yang sedang tayang
    const response = await axios.get('https://api.jikan.moe/v4/seasons/now?limit=24', {
      timeout: 9000
    });

    const items = response.data.data || [];
    const donghuaList = items.map(item => ({
      title: item.title_english || item.title,
      href: item.mal_id.toString(),
      poster: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url
    }));

    res.json({ success: true, data: donghuaList });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Gagal memuat katalog dari API.' });
  }
});

// 2. Endpoint Stream Player Episode
app.get('/api/episode', async (req, res) => {
  try {
    const id = req.query.url;
    if (!id) return res.status(400).json({ error: 'ID episode diperlukan' });

    // Menggunakan pemutar embed anime universal berbasis ID MyAnimeList
    const embedUrl = `https://vidsrc.to/embed/anime/${id}`;

    res.json({
      success: true,
      servers: [{ name: 'Server Pemutar Utama', iframe: embedUrl }]
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports.handler = serverless(app);
