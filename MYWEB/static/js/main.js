// main.js - handles preloader, GSAP animations, particles, typing, theme, mobile menu, testimonials & chat UI

// ---- Utilities ----
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// Debug helper
function updateDebug(message) {
    const debug = document.getElementById('debug-info');
    if (debug) {
        debug.textContent = message;
        debug.classList.remove('hidden');
    }
    console.log(message);
}

// Guard to ensure content display only runs once
let contentStarted = false;
// GSAP init retry counter
let gsapInitAttempts = 0;
// Register GSAP plugins and handle initialization
function initGSAP() {
    updateDebug('Initializing GSAP...');
    
    if (typeof gsap === 'undefined') {
    gsapInitAttempts++;
    if (gsapInitAttempts > 20) {
      updateDebug('GSAP not found after multiple attempts — falling back to CSS-only reveal');
      // Start content display even if GSAP not available
      if (!contentStarted) startContentDisplay();
      return;
    }
    updateDebug('GSAP not loaded, retrying... (' + gsapInitAttempts + ')');
    setTimeout(initGSAP, 100);
    return;
    }
    
    try {
        if (typeof ScrollTrigger !== 'undefined') {
            gsap.registerPlugin(ScrollTrigger);
        }
        if (typeof ScrollToPlugin !== 'undefined') {
            gsap.registerPlugin(ScrollToPlugin);
        }
        updateDebug('GSAP initialized successfully');
        // GSAP is optional now; content/hero/scroll animations use CSS+IntersectionObserver below.
        // Initialize content when DOM is ready (only once)
        document.addEventListener('DOMContentLoaded', () => {
            if (!contentStarted) {
                updateDebug('DOM loaded, starting content display (CSS-based animations).');
                startContentDisplay();
            }
        });
        if (document.readyState === 'complete' && !contentStarted) {
            updateDebug('Page already loaded, starting content display (CSS-based animations).');
            startContentDisplay();
        }
    } catch (e) {
        updateDebug('GSAP initialization error: ' + e.message);
        console.error('GSAP initialization failed:', e);
    }
}

// Start GSAP initialization
initGSAP();

/* -------------------------
  Preloader & initial reveal
   ------------------------- */
// Function to handle content display and animations
function startContentDisplay() {
    updateDebug('Starting content display...');
    
    const pre = document.getElementById('preloader');
    const content = document.getElementById('site-content');
    
    if (!pre || !content) {
        updateDebug('Error: Preloader or content elements not found');
        return;
    }

  if (contentStarted) {
    updateDebug('startContentDisplay already ran - skipping');
    return;
  }
  contentStarted = true;

    // Show content immediately if GSAP fails to load
    if (typeof gsap === 'undefined') {
        updateDebug('GSAP not available, showing content directly');
        pre.style.display = 'none';
        content.style.opacity = '1';
        content.style.visibility = 'visible';
        return;
    }

    updateDebug('Setting up animations...');

    // Reset initial state
    gsap.set(content, {
        opacity: 0,
        display: 'block',
        visibility: 'visible'
    });

    // Create animation timeline
    const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        onComplete: () => {
            pre.remove();
            updateDebug('Initial animations complete');
        }
    });

    // Add animations to timeline
    // Fade out preloader via CSS class then reveal content using CSS
    try {
      pre.style.transition = 'opacity 0.8s ease';
      pre.style.opacity = '0';
      setTimeout(() => {
        pre.remove();
      }, 900);
    } catch (e) { pre.remove(); }

    // Reveal content using CSS classes
    content.classList.remove('opacity-0');
    content.style.transition = 'opacity 0.6s ease';
    content.style.opacity = '1';
    updateDebug('Content visible, starting CSS-based hero and scroll animations...');
    // Hero and scroll animations implemented without GSAP
    startHeroReveal();
    observeScrollReveals();
}
// (removed duplicate document ready starter - initGSAP will trigger startContentDisplay once GSAP and DOM are ready)


/* -------------------------
   Chat form: AJAX submit + display
   ------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chat-form');
  const chatLog = document.getElementById('chat-log');
  const chatInput = document.getElementById('chat-input');
  if (!chatForm || !chatLog || !chatInput) return;

  // Helper: append a message wrapper and return the bubble element for incremental updates
  function createMessageBubble(who = 'user') {
    const wrapper = document.createElement('div');
    wrapper.className = who === 'user' ? 'text-right mb-2' : 'text-left mb-2';
    const bubble = document.createElement('div');
    bubble.className = who === 'user' ? 'inline-block bg-gray-700 text-gray-100 p-2 rounded' : 'inline-block bg-gray-800 text-cyanCustom p-2 rounded';
    // Use a text node for safe incremental typing
    const textNode = document.createTextNode('');
    bubble.appendChild(textNode);
    wrapper.appendChild(bubble);
    chatLog.appendChild(wrapper);
    chatLog.scrollTop = chatLog.scrollHeight;
    return { wrapper, bubble, textNode };
  }

  // Typing indicator for the bot (three-dot animation via JS)
  function showTypingIndicator(){
    const { wrapper, bubble } = createMessageBubble('bot');
    bubble.classList.add('opacity-80', 'italic', 'text-sm');
    const indicator = document.createElement('span');
    indicator.textContent = '...';
    bubble.innerHTML = '';
    bubble.appendChild(indicator);

    let i = 0;
    const frames = ['.', '..', '...'];
    const iv = setInterval(() => {
      indicator.textContent = frames[i % frames.length];
      i++;
      chatLog.scrollTop = chatLog.scrollHeight;
    }, 400);

    return { wrapper, bubble, indicator, stop: () => { clearInterval(iv); } };
  }

  // Type text into a bubble's textNode with a slight per-character delay
  function typeTextInto(node, text, speed = 20) {
    return new Promise(resolve => {
      let i = 0;
      const t = setInterval(() => {
        node.data += text.charAt(i);
        i++;
        chatLog.scrollTop = chatLog.scrollHeight;
        if (i >= text.length) {
          clearInterval(t);
          resolve();
        }
      }, speed);
    });
  }

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    // Show user's message immediately (no typing for user)
    const userBubble = createMessageBubble('user');
    userBubble.textNode.data = text;
    chatInput.value = '';

    // Show bot typing indicator while we wait for reply
    const typing = showTypingIndicator();

    try {
      const res = await fetch('/chat_send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json().catch(() => ({}));
      // Stop typing indicator and replace with real bubble content
      typing.stop();
      // Remove indicator bubble and create a fresh one to type into so styles are consistent
      typing.wrapper.remove();

      if (res.ok && data.ok) {
        const bot = createMessageBubble('bot');
        // animate typing like ChatGPT
        await typeTextInto(bot.textNode, data.reply || 'Thanks! I will reply soon.', 22);
      } else {
        const bot = createMessageBubble('bot');
        await typeTextInto(bot.textNode, (data && data.error) ? data.error : 'Bot failed to respond.', 22);
      }
    } catch (err) {
      typing.stop();
      typing.wrapper.remove();
      const bot = createMessageBubble('bot');
      await typeTextInto(bot.textNode, 'Network error. Try again later.', 22);
    }
  });
});

/* -------------------------
  Theme Toggle Logic (FIXED)
   ------------------------- */
const themeToggleDesktop = document.getElementById("theme-toggle");
const themeToggleMobile = document.getElementById("theme-toggle-mobile");
const themeIconDesktop = document.getElementById("theme-icon");
const themeIconMobile = document.getElementById("theme-icon-mobile");

// Layered SVG markup for sun + moon icons (inserted inside the existing <svg id="theme-icon"> elements)
const ICON_SVG = `
  <g class="icon-sun" style="transform-origin:12px 12px;">
    <circle cx="12" cy="12" r="4" fill="currentColor"></circle>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>
  </g>
  <g class="icon-moon" style="transform-origin:12px 12px;">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor"></path>
  </g>
`;


// Function to update the theme, icon, and save preference
function setTheme(isLight) {
    // Apply theme class and preference
    if (isLight) {
        document.body.classList.add("light-mode");
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.remove("light-mode");
        localStorage.setItem('theme', 'dark');
    }

    // Animate icon transition (sun <-> moon) using GSAP for a pleasant toggle
    try {
      const animateIcon = (svgEl, toLight) => {
        if (!svgEl) return;
        const sun = svgEl.querySelector('.icon-sun');
        const moon = svgEl.querySelector('.icon-moon');

        if (!sun || !moon) return;

        // Timeline: fade/scale out the old icon, fade/scale in the new one with a slight rotate
        const tl = gsap.timeline();
        if (toLight) {
          // show sun, hide moon
          tl.to(moon, { opacity: 0, scale: 0.75, transformOrigin: '12px 12px', duration: 0.28, ease: 'power2.in' })
            .fromTo(sun, { opacity: 0, scale: 0.8, rotation: -20 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.45, ease: 'back.out(1.4)' }, '<');
        } else {
          // show moon, hide sun
          tl.to(sun, { opacity: 0, scale: 0.75, transformOrigin: '12px 12px', duration: 0.28, ease: 'power2.in' })
            .fromTo(moon, { opacity: 0, scale: 0.8, rotation: 20 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.45, ease: 'back.out(1.4)' }, '<');
        }
      };

      animateIcon(themeIconDesktop, isLight);
      animateIcon(themeIconMobile, isLight);
    } catch (e) {
      // If GSAP not present or any error, icons are already the same markup; nothing else to do
    }
}

// Function to load the saved theme preference
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    // Default to dark mode (which is set in base.html) if no preference is saved
    const isLight = savedTheme === 'light';
    
    // Insert layered icon markup into the SVG containers (desktop + mobile)
    if (themeIconDesktop) themeIconDesktop.innerHTML = ICON_SVG;
    if (themeIconMobile) themeIconMobile.innerHTML = ICON_SVG;

    // Set initial visual state without animation (use gsap.set if available)
    try {
      if (typeof gsap !== 'undefined' && typeof gsap.set === 'function') {
        const setState = (svgEl, light) => {
          if (!svgEl) return;
          const sun = svgEl.querySelector('.icon-sun');
          const moon = svgEl.querySelector('.icon-moon');
          if (!sun || !moon) return;
          if (light) {
            gsap.set(sun, { opacity: 1, scale: 1 });
            gsap.set(moon, { opacity: 0, scale: 0.8 });
          } else {
            gsap.set(sun, { opacity: 0, scale: 0.8 });
            gsap.set(moon, { opacity: 1, scale: 1 });
          }
        };
        setState(themeIconDesktop, isLight);
        setState(themeIconMobile, isLight);
      }
    } catch (e) {
      // ignore; icons will show but without animation
    }

    // Apply theme class silently if a saved preference exists
    if (savedTheme) {
      if (isLight) document.body.classList.add('light-mode'); else document.body.classList.remove('light-mode');
    }
}

// Attach event listeners for both desktop and mobile buttons
[themeToggleDesktop, themeToggleMobile].forEach(toggle => {
    if (toggle) {
        toggle.addEventListener("click", () => {
            // Check the current state *before* toggling
            const isCurrentlyLight = document.body.classList.contains("light-mode");
            setTheme(!isCurrentlyLight); // Toggle the state
        });
    }
});

// Load the theme immediately upon script execution
loadTheme();


/* -------------------------\
  Hero typing animation
   ------------------------- */
function typingEffect(target, phrases, speed = 60, pause = 1200) {
  let i = 0, j = 0, deleting = false;
  const el = document.querySelector(target);
  if (!el) return;
  
  // Start with empty text so the typing effect types from blank
  el.textContent = '';

  function tick() {
    const current = phrases[i];
    if (!deleting) {
      el.textContent = current.substring(0, j+1);
      j++;
      if (j > current.length) {
        deleting = true;
        setTimeout(tick, pause);
        return;
      }
    } else {
      el.textContent = current.substring(0, j-1);
      j--;
      if (j === 0) {
        deleting = false;
        i = (i + 1) % phrases.length;
        // Faster transition to next phrase
        setTimeout(tick, speed * 2); 
        return;
      }
    }
    const nextSpeed = deleting ? speed / 2 : speed;
    setTimeout(tick, nextSpeed);
  }
  
  // Start the typing loop
  tick();
}

function heroIntro() {
  // Legacy GSAP heroIntro replaced by CSS-based reveal. Keep function for compatibility.
  // Use CSS classes to animate hero items and then start typing effect.
  const heroElements = $$('#hero [data-scroll-fade]');
  if (!heroElements || heroElements.length === 0) return;

  // Mark hero child items (set .hero-item) then stagger-show them
  heroElements.forEach(el => el.classList.add('hero-item'));

  // Stagger reveal
  heroElements.forEach((el, i) => {
    setTimeout(() => {
      el.classList.add('show');
    }, i * 180);
  });

  // Start typing after the main hero items are visible
  setTimeout(() => {
    typingEffect('.typing-target', ['future with AI.', 'best web applications.', 'high-impact software.'], 60, 1200);
  }, Math.max(600, heroElements.length * 180));
}

// Small adapter so older callsites (startHeroReveal) work — delegates to heroIntro
function startHeroReveal() {
  try {
    heroIntro();
  } catch (e) {
    console.warn('startHeroReveal failed, falling back to simple reveal:', e);
    // simple fallback: reveal all hero items immediately
    $$('#hero [data-scroll-fade]').forEach((el, i) => setTimeout(() => el.classList.add('reveal-active'), i * 120));
  }
}

// New: IntersectionObserver-based scroll reveal
function observeScrollReveals() {
  const revealables = document.querySelectorAll('[data-scroll-fade]');
  if (!('IntersectionObserver' in window)) {
    // fallback: show all
    revealables.forEach(el => el.classList.add('reveal-active'));
    return;
  }

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-active');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealables.forEach(el => io.observe(el));
}


/* -------------------------\
  GSAP Scroll Animations
   ------------------------- */
function initializeScrollAnimations() {
  // 1. General Fade & Slide Up Animation
  $$('[data-scroll-fade]').forEach(element => {
    gsap.from(element, {
      opacity: 0,
      y: 50,
      duration: 1,
      ease: "power2.out",
      immediateRender: false,
      scrollTrigger: {
        trigger: element,
        start: "top bottom-=100", // Start when 100px from the bottom
        toggleActions: "play none none none",
        onEnter: () => {
          // Make sure element is visible when scroll animation triggers
          try { gsap.set(element, { visibility: 'visible' }); } catch(e) { element.style.visibility = 'visible'; }
        }
      }
    });
  });

  // 2. Skill Bar Fill Animation
  $$('.skill-fill').forEach(bar => {
    const level = bar.getAttribute('data-skill-level');
    gsap.fromTo(bar,
      { width: 0 },
      {
        width: `${level}%`,
        duration: 1.5,
        ease: "power2.inOut",
        immediateRender: false,
        scrollTrigger: {
          trigger: bar.parentNode,
          start: "top bottom-=100",
          toggleActions: "play none none none",
          onEnter: () => { try { bar.style.visibility = 'visible'; } catch(e){} }
        }
      }
    );
  });
}


/* -------------------------\
  Smooth Scrolling
   ------------------------- */
$$('.smooth-scroll').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const targetId = this.getAttribute('href');
    const headerHeight = $('#main-header').offsetHeight;
    
    gsap.to(window, {
      duration: 1.2,
      scrollTo: {
        y: targetId,
        offset: headerHeight + 10 // Offset by header height + a little padding
      },
      ease: "power2.inOut"
    });
    // Close mobile menu if open
    if ($('#mobile-menu').style.height !== '0px') {
        const menuButton = $('#menu-button');
        if (menuButton.getAttribute('aria-expanded') === 'true') {
            toggleMobileMenu();
        }
    }
  });
});


/* -------------------------\
  Mobile Menu Toggle
   ------------------------- */
const menuButton = $('#menu-button');
const mobileMenu = $('#mobile-menu');

function toggleMobileMenu() {
    const isExpanded = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', !isExpanded);
    
    if (isExpanded) {
        // Close menu
        gsap.to(mobileMenu, { height: 0, duration: 0.3, ease: "power2.inOut" });
    } else {
        // Open menu (animate to height 'auto')
        gsap.set(mobileMenu, { height: 'auto' });
        gsap.from(mobileMenu, { height: 0, duration: 0.4, ease: "power2.inOut" });
    }
}

if (menuButton) {
    menuButton.addEventListener('click', toggleMobileMenu);
}
// Close menu when a link is clicked
$$('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
        if (menuButton.getAttribute('aria-expanded') === 'true') {
            // Use setTimeout to ensure the scroll starts before menu closes
            setTimeout(toggleMobileMenu, 100); 
        }
    });
});


/* -------------------------\
  Testimonial Carousel
   ------------------------- */
const testimonials = $$('.testi-item');
const totalTesti = testimonials.length;
let currentTesti = 0;
const carouselContainer = $('#testimonial-carousel');

function showTestimonial(index) {
    if (index < 0) index = totalTesti - 1;
    if (index >= totalTesti) index = 0;
    
    const prevTesti = currentTesti;
    currentTesti = index;

    // Use GSAP to handle transitions
    const tl = gsap.timeline({ defaults: { duration: 0.6, ease: "power2.inOut" } });

    // Hide previous testimonial
    tl.to(testimonials[prevTesti], { 
        opacity: 0, 
        zIndex: 1,
        x: (prevTesti < currentTesti) ? -100 : 100, // Slide out left/right
        scale: 0.95
    }, 0);
    
    // Show current testimonial
    tl.fromTo(testimonials[currentTesti], 
        { 
            opacity: 0, 
            zIndex: 10,
            x: (prevTesti < currentTesti) ? 100 : -100, // Slide in from opposite direction
            scale: 0.95
        }, 
        { 
            opacity: 1, 
            zIndex: 10,
            x: 0, 
            scale: 1 
        }, 0.2); // Start slightly later for smooth overlap

    // Ensure the container height adapts
    if (carouselContainer) {
        carouselContainer.style.height = testimonials[currentTesti].offsetHeight + 'px';
    }
}

// Initial height setting
if (carouselContainer && testimonials.length > 0) {
    // Set all except the first one to hidden state
    testimonials.forEach((item, index) => {
        item.style.position = 'absolute';
        item.style.top = 0;
        item.style.left = 0;
        item.style.width = '100%';
        if (index > 0) {
            item.style.opacity = 0;
            item.style.zIndex = 1;
        } else {
            item.style.zIndex = 10;
        }
    });
    // Initialize height
    carouselContainer.style.height = testimonials[0].offsetHeight + 'px';

    // Navigation logic
    $('#next-testi')?.addEventListener('click', () => showTestimonial(currentTesti + 1));
    $('#prev-testi')?.addEventListener('click', () => showTestimonial(currentTesti - 1));
}


/* -------------------------\
  Chat Widget UI Toggle
   ------------------------- */
const chatToggle = $('#chat-toggle');
const chatPanel = $('#chat-panel');
const chatClose = $('#chat-close');

function toggleChatPanel() {
    if (chatPanel.classList.contains('hidden')) {
        chatPanel.classList.remove('hidden');
        gsap.fromTo(chatPanel, 
            { opacity: 0, scale: 0.8, y: 10 },
            { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.7)" }
        );
    } else {
        gsap.to(chatPanel, 
            { opacity: 0, scale: 0.8, y: 10, duration: 0.2, ease: "power2.in", onComplete: () => chatPanel.classList.add('hidden') }
        );
    }
}

if (chatToggle) {
    chatToggle.addEventListener('click', toggleChatPanel);
}
if (chatClose) {
    chatClose.addEventListener('click', toggleChatPanel);
}

/* -------------------------\
  Particle Canvas (Mock)
   ------------------------- */
// This is a simple placeholder to make the canvas functional but not complex.
const canvas = document.getElementById('particles-canvas');
const ctx = canvas?.getContext('2d');
let particlesArray = [];

if (canvas && ctx) {
    canvas.width = window.innerWidth;
    canvas.height = $('#hero').offsetHeight;

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = $('#hero').offsetHeight;
        initParticles();
    });

    class Particle {
        constructor(x, y, directionX, directionY, size, color) {
            this.x = x;
            this.y = y;
            this.directionX = directionX;
            this.directionY = directionY;
            this.size = size;
            this.color = color;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        update() {
            if (this.x > canvas.width || this.x < 0) this.directionX = -this.directionX;
            if (this.y > canvas.height || this.y < 0) this.directionY = -this.directionY;
            this.x += this.directionX;
            this.y += this.directionY;
            this.draw();
        }
    }

    function initParticles() {
        particlesArray = [];
        let numberOfParticles = (canvas.height * canvas.width) / 90000;
        if (window.innerWidth < 768) numberOfParticles = numberOfParticles / 3;

        for (let i = 0; i < numberOfParticles; i++) {
            let size = Math.random() * 2 + 1;
            let x = Math.random() * (canvas.width - size * 2) + size;
            let y = Math.random() * (canvas.height - size * 2) + size;
            let directionX = (Math.random() * 0.4) - 0.2; // very slow movement
            let directionY = (Math.random() * 0.4) - 0.2; // very slow movement
            let color = 'rgba(34, 211, 238, 0.5)'; // Cyan color

            particlesArray.push(new Particle(x, y, directionX, directionY, size, color));
        }
    }

    function animateParticles() {
        requestAnimationFrame(animateParticles);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update();
        }
    }

    initParticles();
    animateParticles();
}


/* -------------------------
   Contact form: AJAX submit (prevents full page reload)
   ------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const contactForm = document.getElementById('contact-form');
  const contactSuccess = document.getElementById('contact-success');
  if (!contactForm) return;

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const formData = new FormData(contactForm);
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      message: formData.get('message')
    };

    try {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.dataset.origText = submitBtn.innerHTML; submitBtn.innerHTML = 'Sending...'; }

      const res = await fetch('/submit_contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        if (contactSuccess) {
          contactSuccess.textContent = data.message || 'Message sent!';
          contactSuccess.classList.remove('hidden');
          contactSuccess.classList.add('block');
        }
        contactForm.reset();
      } else {
        const err = (data && data.error) ? data.error : 'Failed to send, please try again.';
        if (contactSuccess) {
          contactSuccess.textContent = err;
          contactSuccess.classList.remove('hidden');
          contactSuccess.classList.add('block');
          contactSuccess.classList.remove('text-green-400');
          contactSuccess.classList.add('text-red-400');
        }
      }
    } catch (err) {
      if (contactSuccess) {
        contactSuccess.textContent = 'Network error. Please try again later.';
        contactSuccess.classList.remove('hidden');
        contactSuccess.classList.add('block');
        contactSuccess.classList.remove('text-green-400');
        contactSuccess.classList.add('text-red-400');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = submitBtn.dataset.origText || 'Send';
      }
      // Hide success/error after 5s
      if (contactSuccess) setTimeout(() => {
        contactSuccess.classList.add('hidden');
        contactSuccess.classList.remove('block');
        contactSuccess.classList.remove('text-red-400');
        contactSuccess.classList.add('text-green-400');
      }, 5000);
    }
  });
});
