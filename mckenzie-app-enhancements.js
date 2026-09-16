/* McKenzie Ramen House - application UX enhancements
 * Non-destructive layer: uses the existing Firebase/rendering functions and
 * adds guardrails, accessibility, mobile input behavior, and small UX helpers.
 */
(function(){
  'use strict';
  var SECTION_KEY='mck:last-section';
  var lastFocus=null;
  function $id(id){return document.getElementById(id);}
  function safe(fn){try{return fn();}catch(e){console.warn('McKenzie enhancement:',e);}}

  // Prevent mobile Safari from zooming form controls while preserving usability.
  function stabilizeInputs(){
    var style=document.createElement('style');
    style.id='mck-app-enhancements-css';
    style.textContent='@media(max-width:700px){input,textarea,select,button{font-size:16px!important}input[type=search]{font-size:16px!important}textarea{line-height:1.4}body.mck-modal-lock{overscroll-behavior:none}}';
    document.head.appendChild(style);
  }

  // Prevent accidental double submission on order/checkout buttons.
  function guardOrderButtons(){
    document.addEventListener('click',function(e){
      var b=e.target&&e.target.closest?e.target.closest('button'):null;
      if(!b)return;
      var label=(b.textContent||'').trim().toLowerCase();
      if(label==='place order'||label==='yes, place order'){
        if(b.dataset.mckBusy==='1'){e.preventDefault();e.stopPropagation();return;}
        b.dataset.mckBusy='1';
        setTimeout(function(){b.dataset.mckBusy='';},4500);
      }
    },true);
  }

  // Save/restore the user's last visible top-level section without changing routing.
  function trackSections(){
    var sections=['home','about','menu','contact','reviews'];
    sections.forEach(function(id){var el=$id(id);if(!el)return; if('IntersectionObserver' in window){
      var io=new IntersectionObserver(function(entries){entries.forEach(function(en){if(en.isIntersecting&&en.intersectionRatio>=.35){try{sessionStorage.setItem(SECTION_KEY,id);}catch(e){}}});},{threshold:[.35]});io.observe(el);
    }});
    window.addEventListener('beforeunload',function(){try{sessionStorage.setItem(SECTION_KEY,location.hash.replace('#','')||'home');}catch(e){}});
  }

  // Search UX: Escape clears, Enter moves to first visible product.
  function enhanceSearch(){
    var input=$id('mckMenuSearch');if(!input||input.dataset.mckEnhanced)return;
    input.dataset.mckEnhanced='1';
    input.addEventListener('keydown',function(e){
      if(e.key==='Escape'){input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.blur();return;}
      if(e.key==='Enter'){
        var first=document.querySelector('#products .product-card:not(.mck-product-hidden)');
        if(first)first.scrollIntoView({behavior:'smooth',block:'center'});
      }
    });
  }

  // Keyboard-accessible notification items and explicit deep-link fallback.
  function enhanceNotifications(){
    var list=$id('mckCustomerNotificationList');if(!list||list.dataset.mckEnhanced)return;
    list.dataset.mckEnhanced='1';
    var observer=new MutationObserver(function(){
      list.querySelectorAll('.mck-notification-item').forEach(function(el){
        if(el.dataset.mckKeyboard==='1')return;
        el.dataset.mckKeyboard='1';el.tabIndex=0;el.setAttribute('role','button');
        el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}});
      });
    });
    observer.observe(list,{childList:true,subtree:true});
  }

  // Keep order-history tracker fresh while visible, without stealing focus.
  function orderRefreshHeartbeat(){
    setInterval(function(){
      safe(function(){
        var modal=$id('orderHistoryModal');
        if(modal&&modal.classList.contains('show')&&typeof window.openOrderHistory_==='function'){
          // Existing realtime listener handles normal changes; this only repairs a
          // stale tracker after reconnects and does not reopen/close the modal.
          if(typeof window.startCustomerOrderHistoryRealtime_==='function')window.startCustomerOrderHistoryRealtime_();
        }
      });
    },15000);
  }

  // Preserve focus and selection for chat inputs if another script attempts to redraw.
  function protectChatFocus(){
    document.addEventListener('focusin',function(e){
      var el=e.target;if(!el)return;
      if(/^adminChatInput_/.test(String(el.id||''))||el.id==='mckCustomerChatInput'){
        lastFocus={el:el,id:el.id,start:el.selectionStart,end:el.selectionEnd};
      }
    },true);
    document.addEventListener('focusout',function(e){
      if(e.target&&/^adminChatInput_/.test(String(e.target.id||''))){lastFocus=null;}
    },true);
    setInterval(function(){
      if(!lastFocus||!lastFocus.id)return;
      var el=$id(lastFocus.id);
      if(!el||document.activeElement===el||document.activeElement===document.body)return;
      // Only restore if the user still has a draft; never hijack normal navigation.
      if(String(el.value||'').trim())safe(function(){el.focus({preventScroll:true});el.setSelectionRange(lastFocus.start||el.value.length,lastFocus.end||el.value.length);});
    },350);
  }

  // Make the customer support back arrow and close button robust to DOM redraws.
  function bindChatControls(){
    document.addEventListener('click',function(e){
      var el=e.target&&e.target.closest?e.target.closest('#mckCustomerChatBack,#mckCustomerChatClose'):null;
      if(!el)return;
      if(el.id==='mckCustomerChatBack'&&typeof window.backToCustomerSupportTickets_==='function'){
        e.preventDefault();e.stopImmediatePropagation();safe(function(){window.backToCustomerSupportTickets_();});
      }
      if(el.id==='mckCustomerChatClose'&&typeof window.closeCustomerSupportChat_==='function'){
        e.preventDefault();e.stopImmediatePropagation();safe(function(){window.closeCustomerSupportChat_();});
      }
    },true);
  }

  function init(){
    stabilizeInputs();guardOrderButtons();trackSections();enhanceSearch();enhanceNotifications();orderRefreshHeartbeat();protectChatFocus();bindChatControls();
    setTimeout(function(){enhanceSearch();enhanceNotifications();},1200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
