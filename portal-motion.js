import { animate, createAnimatable, createScope } from 'animejs';

const mediaQueries = {
  finePointer: '(hover: hover) and (pointer: fine)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
};
const mission = document.querySelector('#mission-entry');
const reticle = mission?.querySelector('.mission-reticle');
if (mission && reticle) {
  createScope({ root: mission, mediaQueries }).add(self => {
    if (!self.matches.finePointer || self.matches.reducedMotion) return;
    mission.classList.add('has-pointer-reticle');
    const follower = createAnimatable(reticle, { x: 150, y: 150, ease: 'out(3)' });
    self.add('followPointer', event => {
      if (event.pointerType !== 'mouse' || mission.hidden) return;
      const bounds = mission.getBoundingClientRect();
      follower.x(event.clientX - bounds.left - bounds.width / 2);
      follower.y(event.clientY - bounds.top - bounds.height / 2);
    });
    self.add('resetPointer', () => { follower.x(0); follower.y(0); });
    self.add('pointerClick', event => {
      if (event.pointerType !== 'mouse') return;
      animate(reticle.querySelector('b'), {
        scale: [{ to: 2.2, duration: 100 }, { to: 1, duration: 280 }],
        ease: 'out(3)',
      });
    });
    mission.addEventListener('pointermove', self.methods.followPointer);
    mission.addEventListener('pointerleave', self.methods.resetPointer);
    mission.addEventListener('pointerdown', self.methods.pointerClick);
    return () => {
      mission.classList.remove('has-pointer-reticle');
      mission.removeEventListener('pointermove', self.methods.followPointer);
      mission.removeEventListener('pointerleave', self.methods.resetPointer);
      mission.removeEventListener('pointerdown', self.methods.pointerClick);
    };
  });
}

const content = document.querySelector('#content-wrap');
const cardSelector = '.api-card,.doc-mini-card,.pricing-card,.external-api-card,.design-sample-card,.lesson-grid>a,.core-detail-card';
let pageScope;
function refreshPageMotion() {
  pageScope?.revert();
  pageScope = createScope({ root: document.body, mediaQueries }).add(self => {
    if (self.matches.reducedMotion) return;
    const entered = new WeakSet();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entered.has(entry.target)) continue;
        entered.add(entry.target); observer.unobserve(entry.target);
        self.execute(() => animate(entry.target, {
          opacity: { from: .65, to: 1 },
          translateY: { from: 12, to: 0 },
          duration: 420, ease: 'out(3)',
        }));
      }
    }, { threshold: .08 });
    document.querySelectorAll(cardSelector).forEach(card => observer.observe(card));
    const cardTweens = new Map();
    const hover = event => {
      if (!self.matches.finePointer || event.pointerType !== 'mouse') return;
      const card = event.target.closest(cardSelector);
      if (!card || card.contains(event.relatedTarget)) return;
      cardTweens.get(card)?.cancel();
      self.execute(() => cardTweens.set(card, animate(card, {
        scale: event.type === 'pointerover' ? 1.015 : 1,
        duration: 220, ease: 'out(3)',
      })));
    };
    document.addEventListener('pointerover', hover);
    document.addEventListener('pointerout', hover);
    const landingRoom = document.querySelector('.developer-room-landing');
    let handoffFrame = 0;
    self.add('updateHandoff', () => {
      if (!landingRoom || document.body.dataset.page !== 'landing') return;
      cancelAnimationFrame(handoffFrame);
      handoffFrame = requestAnimationFrame(() => {
        const height = Math.max(innerHeight, 1);
        const missionExit = Math.min(1, Math.max(0, scrollY / (height * .55)));
        const roomTop = landingRoom.getBoundingClientRect().top;
        const roomReveal = Math.min(1, Math.max(0, (height - roomTop) / (height * .55)));
        mission?.style.setProperty('--mission-exit', missionExit.toFixed(3));
        mission?.classList.toggle('mission-transition-complete', missionExit > .98);
        landingRoom.style.setProperty('--room-reveal', roomReveal.toFixed(3));
      });
    });
    if (landingRoom) {
      addEventListener('scroll', self.methods.updateHandoff, { passive: true });
      addEventListener('resize', self.methods.updateHandoff);
      self.methods.updateHandoff();
    }
    return () => {
      observer.disconnect(); cardTweens.clear(); cancelAnimationFrame(handoffFrame);
      document.removeEventListener('pointerover', hover);
      document.removeEventListener('pointerout', hover);
      removeEventListener('scroll', self.methods.updateHandoff);
      removeEventListener('resize', self.methods.updateHandoff);
      mission?.style.removeProperty('--mission-exit');
      mission?.classList.remove('mission-transition-complete');
    };
  });
}
refreshPageMotion();
if (content) new MutationObserver(refreshPageMotion).observe(content, { childList: true });
