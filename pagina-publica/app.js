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

// ──────────────── TABS MENÚ Y CARGA DINÁMICA ────────────────
const tabBtns = document.querySelectorAll('.tab-btn');
const menuGrid = document.getElementById('menuGrid');

let menuData = [];

// Iconos por defecto según categoría
const categoryIcons = {
    'Plato Fuerte': '🍖',
    'Caldos': '🍲',
    'Refrescos': '🥤',
    'Cervezas': '🍺'
};

// Mapeo de los dataset de los tabs a las categorías de la base de datos
const catMapping = {
    'platos': 'Plato Fuerte',
    'caldos': 'Caldos',
    'bebidas': ['Refrescos', 'Cervezas']
};

function renderMenu(activeTabObj) {
    if (!menuGrid) return;

    menuGrid.innerHTML = '';

    let activeCat = catMapping[activeTabObj];

    const filteredMenu = menuData.filter(item => {
        if (!item.disponible) return false;

        if (Array.isArray(activeCat)) {
            return activeCat.includes(item.categoria);
        }
        return item.categoria === activeCat;
    });

    if (filteredMenu.length === 0) {
        menuGrid.innerHTML = '<div class="menu-loading">No hay platos disponibles en esta categoría.</div>';
        return;
    }

    filteredMenu.forEach(item => {
        const el = document.createElement('div');
        el.className = 'menu-item';

        // Determinar qué mostrar a la izquierda: imagen real o icono
        let imageHtml = '';
        if (item.imagen_base64) {
            imageHtml = `<img src="${item.imagen_base64}" alt="${item.nombre}" class="menu-item-img" loading="lazy" />`;
        } else {
            const icon = categoryIcons[item.categoria] || '🍽️';
            imageHtml = `<div class="menu-item-icon">${icon}</div>`;
        }

        el.innerHTML = `
            ${imageHtml}
            <div class="menu-item-info">
                <span class="menu-item-name">${item.nombre}</span>
                <span class="menu-item-price">Bs ${item.precio_actual}</span>
            </div>
        `;
        menuGrid.appendChild(el);
    });
}

function initTabs() {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderMenu(btn.dataset.cat);
        });
    });
}

async function loadMenuFromAPI() {
    try {
        const res = await fetch('/api/menu');
        if (!res.ok) throw new Error('Error al cargar menú');
        menuData = await res.json();

        // Renderizar la pestaña activa por defecto (platos)
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            renderMenu(activeTab.dataset.cat);
        }
    } catch (error) {
        console.error('Error fetching menu:', error);
        menuGrid.innerHTML = '<div class="menu-loading text-red-500">Error al cargar el menú. Intenta refrescar la página.</div>';
    }
}

// ──────────────── CARRUSEL DE PROMOCIONES ────────────────
let slides = [];
let currentIdx = 0;

const track = document.getElementById('carouselTrack');
const dotsContainer = document.getElementById('carouselDots');
const prevBtn = document.getElementById('carouselPrev');
const nextBtn = document.getElementById('carouselNext');

function renderCarousel() {
    if (!track) return;
    track.innerHTML = '';

    if (dotsContainer) dotsContainer.innerHTML = '';

    if (slides.length === 0) {
        track.innerHTML = `
      <div class="carousel-empty">
        <span>📷</span>
        <p>No hay promociones activas por el momento.</p>
      </div>`;
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
        return;
    }

    if (prevBtn) prevBtn.style.display = '';
    if (nextBtn) nextBtn.style.display = '';

    slides.forEach((slide, i) => {
        const el = document.createElement('div');
        el.className = 'carousel-slide';

        // Soporte para video
        if (slide.tipo_media === 'video') {
            el.innerHTML = `
                <video src="${slide.media_base64}" autoplay muted loop playsinline></video>
                <div class="video-sound-btn" onclick="toggleMute(this)">
                    <span class="icon-mute">🔇</span>
                </div>
            `;
        } else {
            el.innerHTML = `<img src="${slide.media_base64}" alt="${slide.titulo}" loading="lazy"/>`;
        }

        track.appendChild(el);

        if (dotsContainer) {
            const dot = document.createElement('button');
            dot.className = 'carousel-dot' + (i === currentIdx ? ' active' : '');
            dot.setAttribute('aria-label', `Ir a slide ${i + 1}`);
            dot.addEventListener('click', () => goTo(i));
            dotsContainer.appendChild(dot);
        }
    });

    goTo(currentIdx, false);
}

// Función global para mutear/desmutear videos
window.toggleMute = function (btn) {
    const video = btn.previousElementSibling;
    if (video && video.tagName === 'VIDEO') {
        video.muted = !video.muted;
        btn.innerHTML = video.muted ? '<span class="icon-mute">🔇</span>' : '<span class="icon-unmute">🔊</span>';
    }
};

function goTo(idx, animate = true) {
    if (slides.length === 0 || !track) return;

    currentIdx = ((idx % slides.length) + slides.length) % slides.length;
    if (!animate) track.style.transition = 'none';

    // Calcular desplazamiento en píxeles para centrar la slide actual
    const carouselEl = document.getElementById('carousel');
    const slideEl = track.children[currentIdx];
    if (carouselEl && slideEl) {
        const containerW = carouselEl.clientWidth;
        const slideW = slideEl.offsetWidth;
        const offset = slideEl.offsetLeft;
        const translate = Math.max(0, offset - (containerW - slideW) / 2);
        track.style.transform = `translateX(-${translate}px)`;
    } else {
        track.style.transform = `translateX(0)`;
    }

    requestAnimationFrame(() => { track.style.transition = ''; });

    // Actualizar dots
    document.querySelectorAll('.carousel-dot').forEach((d, i) =>
        d.classList.toggle('active', i === currentIdx)
    );

    // Pausar/reproducir videos según estén a la vista (opcional para rendimiento)
    Array.from(track.children).forEach((slide, i) => {
        const video = slide.querySelector('video');
        if (video) {
            if (i === currentIdx) video.play().catch(e => console.log("Autoplay prevencion:", e));
            else video.pause();
        }
    });
}

// Recalcular posición al redimensionar para mantener la slide centrada
window.addEventListener('resize', () => {
    goTo(currentIdx, false);
});

prevBtn?.addEventListener('click', () => goTo(currentIdx - 1));
nextBtn?.addEventListener('click', () => goTo(currentIdx + 1));

// Auto-avance cada 5 segundos si no es video, o si es video dejar que termine (simplificado: 5s fijos)
let autoplay = setInterval(() => goTo(currentIdx + 1), 6000);
document.getElementById('carousel')?.addEventListener('pointerenter', () => clearInterval(autoplay));
document.getElementById('carousel')?.addEventListener('pointerleave', () => {
    autoplay = setInterval(() => goTo(currentIdx + 1), 6000);
});

async function loadPromocionesAPI() {
    try {
        const res = await fetch('/api/promociones?activa=true');
        if (!res.ok) throw new Error('Error al cargar promociones');
        slides = await res.json();
    } catch (e) {
        console.error(e);
        slides = [];
    }
    renderCarousel();
}

// ──────────────── INIT ────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadMenuFromAPI();
    loadPromocionesAPI();
});
