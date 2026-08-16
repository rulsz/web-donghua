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
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
};

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. Endpoint Ambil List Donghua (Homepage / Catalog)
app.get('/api/list', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const search = req.query.s || '';
    
    // Jika ada pencarian, gunakan query ?s=, jika tidak ambil dari halaman catalog
    const targetUrl = search 
      ? `${BASE_URL}/page/${page}/?s=${encodeURIComponent(search)}`
      : `${BASE_URL}/donghua/page/${page}/`;

    const { data: html } = await axios.get(targetUrl, { headers: HEADERS });
    const $ = cheerio.load(html);
    const donghuaList = [];

    // Mengambil elemen kartu donghua dari HTML WordPress
    $('div.listupd article.bs, div.animposx').each((i, el) => {
      const card = $(el);
      const title = card.find('div.tt, h2, .title').text().trim();
      const href = card.find('a').attr('href');
      const poster = card.find('img').attr('src') || card.find('img').attr('data-src');

      if (title && href) {
        donghuaList.push({ title, href, poster });
      }
    });

    res.json({ success: true, page: Number(page), data: donghuaList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Endpoint Scraper Player Episode Video
app.get('/api/episode', async (req, res) => {
  try {
    const episodeUrl = req.query.url;
    if (!episodeUrl) return res.status(400).json({ error: 'URL episode diperlukan' });

    const { data: html } = await axios.get(episodeUrl, { headers: HEADERS });
    const $ = cheerio.load(html);
    const servers = [];

    const directIframe = $('div.player-embed iframe, div.embed-holder iframe, iframe').first().attr('src');
    if (directIframe) {
      servers.push({ name: 'Server Utama', iframe: directIframe });
    }

    const options = $('select.mirror option, div.server-select select option, select#select-server option, option[data-post]');

    for (let i = 0; i < options.length; i++) {
      const el = $(options[i]);
      const postId = el.attr('data-post') || el.attr('data-id');
      const serverType = el.attr('data-type') || el.attr('value') || el.attr('data-index');
      const serverName = el.text().trim() || `Server ${i + 1}`;

      if (postId && serverType) {
        const actions = ['player_ajax', 'muvipro_player_content', 'get_player'];
        
        for (const actionName of actions) {
          try {
            const params = new URLSearchParams();
            params.append('action', actionName);
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
              break;
            }
          } catch (e) {}
        }
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
