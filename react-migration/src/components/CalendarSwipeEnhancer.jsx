import { useEffect } from 'react';

export default function CalendarSwipeEnhancer() {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let activeCard = null;
    let suppressClickUntil = 0;

    function findCard(target) {
      return target instanceof Element ? target.closest('.calendar-month-card') : null;
    }

    function onTouchStart(event) {
      const card = findCard(event.target);
      if (!card || event.touches.length !== 1) return;
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      activeCard = card;
      tracking = true;
      card.style.touchAction = 'pan-y';
    }

    function onTouchEnd(event) {
      if (!tracking || !activeCard || event.changedTouches.length !== 1) {
        tracking = false;
        activeCard = null;
        return;
      }

      const touch = event.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const horizontalSwipe = Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.25;

      if (horizontalSwipe) {
        const navigation = document.querySelector('.calendar-month-navigation');
        const buttons = navigation ? Array.from(navigation.querySelectorAll('button')) : [];
        const targetButton = dx < 0 ? buttons[buttons.length - 1] : buttons[0];
        if (targetButton) {
          suppressClickUntil = Date.now() + 350;
          targetButton.click();
        }
      }

      tracking = false;
      activeCard = null;
    }

    function onTouchCancel() {
      tracking = false;
      activeCard = null;
    }

    function onClickCapture(event) {
      if (Date.now() < suppressClickUntil && findCard(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });
    document.addEventListener('click', onClickCapture, true);

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  return null;
}
