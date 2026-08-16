const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static('public'));

const TARGET_SITE = 'https://anichin.moe';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Helper function untuk mengambil HTML lewat Proxy jika request langsung diblokir
async function fetchHTML(url) {
  try {
    // 1. Coba request langsung
    const res = await axios.get(url, { headers: HEADERS, timeout: 5000 });
    return res.data;
  } catch (err) {
    // 2. Jika diblokir (Cloudflare 403/503), gunakan AllOrigins Proxy Service
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const resProxy = await axios.get(proxyUrl, { timeout: 8000 });
    return resProxy.data.contents;
  }
}

// 1. Endpoint Catalog List
app.get('/api/list', async (req, res) => {
  try {
    const html = await fetchHTML(TARGET_SITE);
    if (!html) return res.status(500).json({ error: 'Gagal menembus proteksi web' });

    const $ = cheerio.load(html);
    const donghuaList = [];

    // Parsing struktur HTML WordPress Anime (Anichin / Donghub)
    $('article, div.bs, div.animposx, div.post-show').each((i, el) => {
      const card = $(el);
      const title = card.find('div.tt, h2, .title, .entry-title').first().text().trim();
      const href = card.find('a').first().attr('href');
      
      const imgEl = card.find('img').first();
      let poster = imgEl.attr('data-src') || imgEl.attr('src') || imgEl.attr('data-lazy-src');

      if (title && href && href.includes('http')) {
        donghuaList.push({
          title: title.replace(/\s+/g, ' '),
          href: href,
          poster: poster || 'https://via.placeholder.com/150'
        });
      }
    });

    // Filter duplikat
    const uniqueList = donghuaList.filter((v, i, a) => a.findIndex(t => t.href === v.href) === i);

    res.json({ success: true, count: uniqueList.length, data: uniqueList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Endpoint Stream Player Episode
app.get('/api/episode', async (req, res) => {
  try {
    const episodeUrl = req.query.url;
    if (!episodeUrl) return res.status(400).json({ error: 'URL episode diperlukan' });

    const html = await fetchHTML(episodeUrl);
    const $ = cheerio.load(html);
    const servers = [];

    // Ambil iframe utama yang ada di halaman
    const directIframe = $('div.player-embed iframe, div.embed-holder iframe, iframe').first().attr('src');
    if (directIframe) {
      servers.push({ name: 'Server Utama', iframe: directIframe });
    }

    // Ambil opsi dari select option
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

          const ajaxRes = await axios.post(`${TARGET_SITE}/wp-admin/admin-ajax.php`, params, {
            headers: {
              ...HEADERS,
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': episodeUrl
            },
            timeout: 5000
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
app.listen(PORT, () => console.log(`Server cloud berjalan di port ${PORT}`));
