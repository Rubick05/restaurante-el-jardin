/* ════════════════════════════════════════════
   Restaurante El Jardín — app.js
   Maneja: nav scroll, tabs menú, carrusel,
           upload de fotos de promoción (localStorage)
════════════════════════════════════════════ */

// ──────────────── NAV SCROLL ────────────────
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
});

// ──────────────── NAV MOBILE ────────────────
const navToggle = document.getElementById('navToggle');
const navLinks = document.querySelector('.nav-links');
navToggle?.addEventListener('click', () => navLinks.classList.toggle('open'));
document.querySelectorAll('.nav-links a').forEach(a =>
    a.addEventListener('click', () => navLinks.classList.remove('open'))
);

// ──────────────── TABS MENÚ ────────────────
const tabBtns = document.querySelectorAll('.tab-btn');
const menuItems = document.querySelectorAll('.menu-item');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.cat;
        menuItems.forEach(item => {
            item.classList.toggle('hidden', item.dataset.cat !== cat);
        });
    });
});

// ──────────────── CARRUSEL ────────────────
const STORAGE_KEY = 'eljardin-promociones';

let slides = [];
let currentIdx = 0;

const track = document.getElementById('carouselTrack');
const dotsContainer = document.getElementById('carouselDots');
const prevBtn = document.getElementById('carouselPrev');
const nextBtn = document.getElementById('carouselNext');

function renderCarousel() {
    track.innerHTML = '';
    dotsContainer.innerHTML = '';

    if (slides.length === 0) {
        track.innerHTML = `
      <div class="carousel-empty">
        <span>📷</span>
        <p>Sin promociones activas. El admin puede subir fotos abajo.</p>
      </div>`;
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        return;
    }

    prevBtn.style.display = '';
    nextBtn.style.display = '';

    slides.forEach((slide, i) => {
        const el = document.createElement('div');
        el.className = 'carousel-slide';
        el.innerHTML = `
      <img src="${slide.src}" alt="${slide.caption || 'Promoción'}" loading="lazy"/>
      ${slide.caption ? `<div class="slide-caption"><h3>${slide.caption}</h3></div>` : ''}
    `;
        track.appendChild(el);

        const dot = document.createElement('button');
        dot.className = 'carousel-dot' + (i === currentIdx ? ' active' : '');
        dot.setAttribute('aria-label', `Ir a slide ${i + 1}`);
        dot.addEventListener('click', () => goTo(i));
        dotsContainer.appendChild(dot);
    });

    goTo(currentIdx, false);
}

function goTo(idx, animate = true) {
    currentIdx = ((idx % slides.length) + slides.length) % slides.length;
    if (!animate) track.style.transition = 'none';
    track.style.transform = `translateX(-${currentIdx * 100}%)`;
    requestAnimationFrame(() => {
        track.style.transition = '';
    });
    document.querySelectorAll('.carousel-dot').forEach((d, i) =>
        d.classList.toggle('active', i === currentIdx)
    );
}

prevBtn?.addEventListener('click', () => goTo(currentIdx - 1));
nextBtn?.addEventListener('click', () => goTo(currentIdx + 1));

// Auto-avance cada 5 segundos
let autoplay = setInterval(() => goTo(currentIdx + 1), 5000);
document.getElementById('carousel')?.addEventListener('pointerenter', () => clearInterval(autoplay));
document.getElementById('carousel')?.addEventListener('pointerleave', () => {
    autoplay = setInterval(() => goTo(currentIdx + 1), 5000);
});

// ──────────────── CARGAR DESDE LOCALSTORAGE ────────────────
function cargarPromos() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        slides = raw ? JSON.parse(raw) : [];
    } catch { slides = []; }
    renderCarousel();
}

function guardarPromos() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slides));
}

// ──────────────── UPLOAD DE FOTOS ────────────────
const promoInput = document.getElementById('promoInput');
const uploadArea = document.getElementById('uploadArea');

// Click en área de upload
uploadArea?.addEventListener('click', (e) => {
    if (e.target !== promoInput) promoInput?.click();
});

promoInput?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    let loaded = 0;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const caption = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
            slides.push({ src: ev.target.result, caption });
            loaded++;
            if (loaded === files.length) {
                guardarPromos();
                currentIdx = slides.length - files.length;
                renderCarousel();
            }
        };
        reader.readAsDataURL(file);
    });
    e.target.value = '';
});

// Drag & drop
uploadArea?.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.borderColor = '#c8842a'; });
uploadArea?.addEventListener('dragleave', () => { uploadArea.style.borderColor = ''; });
uploadArea?.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.style.borderColor = '';
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    let loaded = 0;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            slides.push({ src: ev.target.result, caption: file.name.replace(/\.[^.]+$/, '') });
            loaded++;
            if (loaded === files.length) { guardarPromos(); renderCarousel(); }
        };
        reader.readAsDataURL(file);
    });
});

// Limpiar todas las fotos
document.getElementById('clearPromos')?.addEventListener('click', () => {
    if (!confirm('¿Eliminar todas las fotos de promoción?')) return;
    slides = [];
    guardarPromos();
    renderCarousel();
});

// ──────────────── INIT ────────────────
cargarPromos();
