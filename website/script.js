document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('.hero-section');
    const items = document.querySelectorAll('.float-item');
    document.addEventListener('mousemove', (e) => {
        const x = e.clientX;
        const y = e.clientY;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        items.forEach((item, index) => {
            const depth = parseFloat(item.getAttribute('data-depth')) || 0.2;
            const moveX = (x - centerX) * depth * -0.05;
            const moveY = (y - centerY) * depth * -0.05;
            const rotate = (x - centerX) * 0.02;
            item.style.transform = `translate(${moveX}px, ${moveY}px) rotate(${rotate}deg)`;
        });
    });
    items.forEach((item, index) => {
        const delay = index * 1000;
        const duration = 3000 + Math.random() * 2000;
        item.animate([
            { transform: 'translateY(0px)' },
            { transform: 'translateY(-15px)' },
            { transform: 'translateY(0px)' }
        ], {
            duration: duration,
            delay: delay,
            iterations: Infinity,
            easing: 'ease-in-out',
            composite: 'add'
        });
    });
});