const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static('public'));

const TARGET_SITE = 'https://anichin.moe';

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Helper untuk tembus Cloudflare dengan rotasi Proxy Service
async function getHTMLWithProxy(targetUrl) {
  const proxies = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
  ];

  for (const proxy of proxies) {
    try {
      const res = await axios.get(proxy, { timeout: 6000 });
      let html = '';
      if (typeof res.data === 'object' && res.data.contents) {
        html = res.data.contents;
      } else if (typeof res.data === 'string') {
        html = res.data;
      }

      if (html && html.includes('article')) {
        return html;
      }
    } catch (e) {
      // Coba proxy berikutnya jika gagal
    }
  }
  return null;
}

// 1. Endpoint Katalog (Backend Proxy)
app.get('/api/list', async (req, res) => {
  try {
    const html = await getHTMLWithProxy(TARGET_SITE);
    
    if (!html) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil data katalog' });
    }

    const $ = cheerio.load(html);
    const donghuaList = [];

    $('article, div.bs, div.post-show').each((i, el) => {
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

    const uniqueList = donghuaList.filter((v, i, a) => a.findIndex(t => t.href === v.href) === i);
    res.json({ success: true, data: uniqueList });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Endpoint Stream Player Episode
app.get('/api/episode', async (req, res) => {
  try {
    const episodeUrl = req.query.url;
    if (!episodeUrl) return res.status(400).json({ error: 'URL episode diperlukan' });

    const html = await getHTMLWithProxy(episodeUrl);
    if (!html) return res.status(500).json({ error: 'Gagal memuat episode' });

    const $ = cheerio.load(html);
    const servers = [];

    const directIframe = $('div.player-embed iframe, div.embed-holder iframe, iframe').first().attr('src');
    if (directIframe) {
      servers.push({ name: 'Server Utama', iframe: directIframe });
    }

    res.json({ success: true, servers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
