const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const TARGET_SITE = 'https://anichin.moe';

async function scrapeAnichin() {
  console.log('Memulai scraping Anichin...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--single-process'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Buka halaman
    await page.goto(TARGET_SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Tunggu 8 detik untuk memberi waktu Cloudflare menyelesaikan tantangan otomatis
    await new Promise(r => setTimeout(r, 8000));

    const donghuaList = await page.evaluate(() => {
      const items = [];
      // Cari berbagai selector kartu donghua yang umum di WordPress Anime
      const cards = document.querySelectorAll('article, div.bs, div.bsx, div.post-show, div.animposx');
      
      cards.forEach(card => {
        const titleEl = card.querySelector('div.tt, h2, h3, .title, .entry-title');
        const linkEl = card.querySelector('a');
        const imgEl = card.querySelector('img');

        if (titleEl && linkEl) {
          const title = titleEl.innerText.trim();
          const href = linkEl.getAttribute('href');
          let poster = '';

          if (imgEl) {
            poster = imgEl.getAttribute('data-src') || 
                     imgEl.getAttribute('src') || 
                     imgEl.getAttribute('data-lazy-src') || '';
          }

          if (href && (href.includes('anichin') || href.startsWith('http'))) {
            items.push({
              title: title.replace(/\s+/g, ' '),
              href: href,
              poster: poster || 'https://via.placeholder.com/150'
            });
          }
        }
      });
      return items;
    });

    // Filter duplikat berdasarkan URL
    const uniqueList = donghuaList.filter((v, i, a) => a.findIndex(t => t.href === v.href) === i);
    
    console.log(`Ditemukan ${uniqueList.length} item.`);
    fs.writeFileSync('data.json', JSON.stringify({ updated: new Date(), data: uniqueList }, null, 2));
    console.log('Berhasil memperbarui data.json!');

  } catch (err) {
    console.error('Scraping gagal:', err.message);
  } finally {
    await browser.close();
  }
}

scrapeAnichin();
