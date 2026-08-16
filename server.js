const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static('public'));

const BASE_URL = 'https://donghub.vip';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// Serving halaman utama index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint Scraper Server Video
app.get('/api/episode', async (req, res) => {
  try {
    const episodeUrl = req.query.url;
    if (!episodeUrl) return res.status(400).json({ error: 'URL episode diperlukan' });

    const { data: html } = await axios.get(episodeUrl, { headers: HEADERS });
    const $ = cheerio.load(html);
    const servers = [];

    const options = $('div.server-select select option, select.mirror option');
    
    for (let i = 0; i < options.length; i++) {
      const el = $(options[i]);
      const postId = el.attr('data-post');
      const serverType = el.attr('data-type') || el.attr('value');
      const serverName = el.text().trim();

      if (postId) {
        const params = new URLSearchParams();
        params.append('action', 'player_ajax');
        params.append('post', postId);
        params.append('type', serverType);

        const ajaxRes = await axios.post(`${BASE_URL}/wp-admin/admin-ajax.php`, params, {
          headers: {
            ...HEADERS,
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': episodeUrl
          }
        });

        let iframeSrc = '';
        if (typeof ajaxRes.data === 'object' && ajaxRes.data.html) {
          const $ajax = cheerio.load(ajaxRes.data.html);
          iframeSrc = $ajax('iframe').attr('src');
        } else {
          const $ajax = cheerio.load(ajaxRes.data);
          iframeSrc = $ajax('iframe').attr('src');
        }

        if (iframeSrc) {
          servers.push({ name: serverName, iframe: iframeSrc });
        }
      }
    }

    res.json({ success: true, servers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server cloud berjalan di port ${PORT}`));
