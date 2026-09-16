(function(){
  'use strict';
  function init(){
    var st=document.createElement('style');st.id='mck-admin-enhancements-css';st.textContent='@media(max-width:700px){textarea,input,select,button{font-size:16px!important}.customer-chat-messages{overscroll-behavior:contain;-webkit-overflow-scrolling:touch}}';document.head.appendChild(st);
    document.addEventListener('focusin',function(e){var el=e.target;if(!el||!/^adminChatInput_/.test(String(el.id||'')))return;var y=window.scrollY||window.pageYOffset||0;requestAnimationFrame(function(){window.scrollTo(0,y);try{el.focus({preventScroll:true});}catch(x){}});},true);
    document.addEventListener('keydown',function(e){var el=e.target;if(el&&/^adminChatInput_/.test(String(el.id||''))&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();var b=el.closest('.customer-chat-compose')&&el.closest('.customer-chat-compose').querySelector('button[data-chat-id]');if(b&&!b.disabled)b.click();}},true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
