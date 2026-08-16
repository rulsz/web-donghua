const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static('public'));

const BASE_URL = 'https://anichin.moe';

// Header khusus untuk lolos anti-bot dasar
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Referer': 'https://anichin.moe/'
};

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. Endpoint Catalog / List Donghua Anichin
app.get('/api/list', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const targetUrl = page > 1 ? `${BASE_URL}/page/${page}/` : BASE_URL;

    const { data: html } = await axios.get(targetUrl, { 
      headers: HEADERS,
      timeout: 8000 
    });
    
    const $ = cheerio.load(html);
    const donghuaList = [];

    // Selector khusus struktur HTML Anichin (Theme WordPress Anime)
    $('div.listupd article.bs, div.post-show, article').each((i, el) => {
      const card = $(el);
      
      const title = card.find('div.tt, h2, .title, .entry-title').first().text().trim();
      const href = card.find('a').first().attr('href');
      
      const imgEl = card.find('img').first();
      let poster = imgEl.attr('data-src') || imgEl.attr('src') || imgEl.attr('data-lazy-src');

      if (title && href && href.includes('anichin')) {
        donghuaList.push({
          title: title.replace(/\s+/g, ' '),
          href: href,
          poster: poster || 'https://via.placeholder.com/150'
        });
      }
    });

    // Clean duplicate item
    const uniqueList = donghuaList.filter((v, i, a) => a.findIndex(t => t.href === v.href) === i);

    res.json({ success: true, count: uniqueList.length, data: uniqueList });
  } catch (error) {
    res.status(500).json({ error: error.message, note: 'Terhalang blokir anti-bot Anichin/Cloudflare' });
  }
});

// 2. Endpoint Stream Player Episode
app.get('/api/episode', async (req, res) => {
  try {
    const episodeUrl = req.query.url;
    if (!episodeUrl) return res.status(400).json({ error: 'URL episode diperlukan' });

    const { data: html } = await axios.get(episodeUrl, { headers: HEADERS });
    const $ = cheerio.load(html);
    const servers = [];

    // Ambil iframe utama jika ada
    const directIframe = $('div.player-embed iframe, div.embed-holder iframe, iframe').first().attr('src');
    if (directIframe) {
      servers.push({ name: 'Server Utama', iframe: directIframe });
    }

    // Ambil pilihan server dari dropdown/select
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

          const ajaxRes = await axios.post(`${BASE_URL}/wp-admin/admin-ajax.php`, params, {
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
