const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static('public'));

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint Stream Player Episode (Ringan & Cepat)
app.get('/api/episode', async (req, res) => {
  try {
    const episodeUrl = req.query.url;
    if (!episodeUrl) return res.status(400).json({ error: 'URL episode diperlukan' });

    // Gunakan AllOrigins proxy jika request langsung gagal
    let html = '';
    try {
      const direct = await axios.get(episodeUrl, { headers: HEADERS, timeout: 4000 });
      html = direct.data;
    } catch (e) {
      const proxyRes = await axios.get(`https://api.allorigins.win/get?url=${encodeURIComponent(episodeUrl)}`, { timeout: 6000 });
      html = proxyRes.data.contents;
    }

    const $ = cheerio.load(html);
    const servers = [];

    const directIframe = $('div.player-embed iframe, div.embed-holder iframe, iframe').first().attr('src');
    if (directIframe) {
      servers.push({ name: 'Server Utama', iframe: directIframe });
    }

    const options = $('select.mirror option, div.server-select select option, option[data-post]');

    for (let i = 0; i < options.length; i++) {
      const el = $(options[i]);
      const postId = el.attr('data-post') || el.attr('data-id');
      const serverType = el.attr('data-type') || el.attr('value');
      const serverName = el.text().trim() || `Server ${i + 1}`;

      if (postId && serverType) {
        try {
          const params = new URLSearchParams();
          params.append('action', 'player_ajax');
          params.append('post', postId);
          params.append('type', serverType);

          const ajaxRes = await axios.post('https://anichin.moe/wp-admin/admin-ajax.php', params, {
            headers: {
              ...HEADERS,
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': episodeUrl
            },
            timeout: 4000
          });

          let iframeSrc = '';
          const resData = ajaxRes.data;

          if (typeof resData === 'object' && resData.html) {
            iframeSrc = cheerio.load(resData.html)('iframe').attr('src');
          } else if (typeof resData === 'string') {
            iframeSrc = cheerio.load(resData)('iframe').attr('src');
          }

          if (iframeSrc) {
            servers.push({ name: serverName, iframe: iframeSrc });
          }
        } catch (e) {}
      }
    }

    const uniqueServers = servers.filter((v, i, a) => a.findIndex(t => t.iframe === v.iframe) === i);
    res.json({ success: true, servers: uniqueServers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
