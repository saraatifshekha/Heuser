/* ==========================================================================
   INTERACTIVE DIGITAL DIARY - SHARED INTERACTION SCRIPT (js/script.js)
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // Smooth exit transition when clicking internal diary objects
    const diaryLinks = document.querySelectorAll('a[data-diary-nav]');
    const spread = document.querySelector('.diary-spread');

    diaryLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (!href || href.startsWith('http')) return;

            e.preventDefault();
            if (spread) {
                spread.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
                spread.style.opacity = '0';
                spread.style.transform = 'translateY(-10px) scale(0.99)';
            }
            setTimeout(() => {
                window.location.href = href;
            }, 260);
        });
    });

    // Subtle interactive tilt response on keepsake objects
    const keepsakes = document.querySelectorAll('.keepsake-object');
    keepsakes.forEach(item => {
        item.addEventListener('mouseenter', () => {
            item.setAttribute('aria-expanded', 'true');
        });
        item.addEventListener('mouseleave', () => {
            item.removeAttribute('aria-expanded');
        });
    });
});
