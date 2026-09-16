(function(){
  'use strict';
  function bind(){
    var close=document.getElementById('adminMobileMenuClose');
    if(close&&!close.dataset.jpBound){close.dataset.jpBound='1';close.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(typeof closeAdminMobileMenu_==='function')closeAdminMobileMenu_();},true);}
    var toast=document.querySelector('.toast-close');
    if(toast&&!toast.dataset.jpBound){toast.dataset.jpBound='1';toast.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(typeof hideAdminToast==='function')hideAdminToast();},true);}
    document.addEventListener('keydown',function(e){if(e.key==='Escape'){var m=document.getElementById('modal');if(m&&m.classList.contains('open')&&typeof closeModal==='function')closeModal();if(document.body.classList.contains('admin-mobile-menu-open')&&typeof closeAdminMobileMenu_==='function')closeAdminMobileMenu_();}},true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
