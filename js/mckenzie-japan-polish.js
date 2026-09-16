(function(){
  'use strict';
  var MODAL_IDS={
    loginModal:'closeLoginModal',
    createAccountModal:'closeCreateAccountModal',
    cartModal:'closeCartModal_',
    editProfileModal:"closeAccountSubmodal_('editProfileModal')",
    checkoutModal:"closeAccountSubmodal_('checkoutModal')",
    orderHistoryModal:"closeAccountSubmodal_('orderHistoryModal')",
    mckCustomerNotificationsModal:'closeCustomerNotifications_',
    paymentHistoryModal:"closeAccountSubmodal_('paymentHistoryModal')",
    couponsModal:"closeAccountSubmodal_('couponsModal')",
    forgotPasswordModal:'closeForgotPassword_',
    passwordOtpModal:'closePasswordOtp_',
    changePasswordModal:'closeChangePassword_',
    emailVerificationModal:'closeEmailVerificationModal',
    mckSurveyModal:'closeSurveyModal_',
    mckReceiptModal:'closeReceipt_',
    mckCustomerChatModal:'closeCustomerSupportChat_'
  };
  function callClose(id){
    try{
      var fn=MODAL_IDS[id]; if(!fn)return false;
      if(fn.indexOf('(')>-1){ new Function(fn+';')(); return true; }
      var f=window[fn]; if(typeof f==='function'){f();return true;}
    }catch(e){console.warn('Mckenzie close handler:',id,e)}
    return false;
  }
  function bindCloseButtons(){
    document.querySelectorAll('.login-close,.create-account-close,.cart-close,.account-subclose,.address-close,.password-close,.verification-close,#mckSurveyClose,#mckReceiptClose,#mckCustomerChatClose').forEach(function(btn){
      if(btn.dataset.jpCloseBound==='1')return;
      btn.dataset.jpCloseBound='1';
      btn.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        if(btn.id==='mckCustomerChatClose' && typeof window.closeCustomerSupportChat_==='function') return window.closeCustomerSupportChat_();
        if(btn.classList.contains('address-close') && typeof window.closeAddAddressModal_==='function') return window.closeAddAddressModal_();
        var modal=btn.closest('[role="dialog"],.account-submodal,.password-modal,.cart-modal,.address-modal');
        if(modal && callClose(modal.id))return;
        var onclick=btn.getAttribute('onclick');
        if(onclick){try{new Function(onclick).call(btn)}catch(err){}}
      },true);
    });
    var back=document.getElementById('mckCustomerChatBack');
    if(back&&!back.dataset.jpBackBound){
      back.dataset.jpBackBound='1';
      back.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(typeof window.backToCustomerSupportTickets_==='function')window.backToCustomerSupportTickets_();},true);
    }
  }
  function bindEsc(){
    if(document.documentElement.dataset.jpEscBound==='1')return;
    document.documentElement.dataset.jpEscBound='1';
    document.addEventListener('keydown',function(e){
      if(e.key!=='Escape')return;
      var chat=document.getElementById('mckCustomerChatModal');
      if(chat&&chat.classList.contains('show')){callClose('mckCustomerChatModal');return;}
      var dialogs=[].slice.call(document.querySelectorAll('[role="dialog"],.account-submodal,.password-modal,.cart-modal,.address-modal')).filter(function(m){return m.classList.contains('show')||m.style.display==='flex'||m.getAttribute('aria-hidden')==='false';});
      if(dialogs.length)callClose(dialogs[dialogs.length-1].id);
    });
  }
  function renderSavedAddresses(){
    var host=document.getElementById('profileSavedAddressesList');
    if(!host)return;
    var user=typeof getSavedUser_==='function'?getSavedUser_():null;
    var uid=typeof customerCurrentUserId_==='function'?customerCurrentUserId_():String(user&&user.uid||'');
    if(!uid){host.innerHTML='<div class="jp-address-empty">Sign in to view your saved delivery addresses.</div>';return;}
    if(typeof window.MckenzieFirebaseReady==='undefined'){host.innerHTML='<div class="jp-address-empty">Loading saved addresses…</div>';return;}
    Promise.resolve(window.MckenzieFirebaseReady).then(function(f){
      if(!f||!f.getDocs||!f.query)return;
      return f.getDocs(f.query(f.collection(f.db,'addresses'),f.where('userId','==',String(uid))));
    }).then(function(snap){
      if(!snap)return;
      var rows=snap.docs.map(function(d){return Object.assign({addressId:d.id},d.data()||{});}).sort(function(a,b){return (b.isDefault?1:0)-(a.isDefault?1:0);});
      if(!rows.length){host.innerHTML='<div class="jp-address-empty">No saved addresses yet. Your checkout address will be saved here automatically.</div>';return;}
      host.innerHTML=rows.map(function(a){
        var line=[a.houseUnit,a.street,a.barangay,a.city,a.province].filter(Boolean).join(', ');
        return '<div class="jp-address-card '+(a.isDefault?'is-default':'')+'"><div class="jp-address-top"><strong>'+esc(String(a.label||'Delivery Address'))+'</strong>'+(a.isDefault?'<span class="jp-default-pill">DEFAULT</span>':'')+'</div><div class="jp-address-line">'+esc(line||'Address details saved')+'</div><div class="jp-address-sub">'+esc([a.region,a.postalCode].filter(Boolean).join(' · '))+'</div>'+(a.additionalInstruction?'<div class="jp-address-note">📍 '+esc(a.additionalInstruction)+'</div>':'')+'</div>';
      }).join('');
    }).catch(function(e){host.innerHTML='<div class="jp-address-empty">Unable to load saved addresses right now.</div>';});
  }
  function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});}
  function bindProfileObserver(){
    var modal=document.getElementById('editProfileModal');
    if(!modal||modal.dataset.jpProfileBound)return;
    modal.dataset.jpProfileBound='1';
    new MutationObserver(function(){if(modal.classList.contains('show'))setTimeout(renderSavedAddresses,80);}).observe(modal,{attributes:true,attributeFilter:['class','style']});
  }
  function init(){bindCloseButtons();bindEsc();bindProfileObserver();if(document.getElementById('editProfileModal')?.classList.contains('show'))renderSavedAddresses();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.MckenzieJapanPolish={refreshSavedAddresses:renderSavedAddresses,bindCloseButtons:bindCloseButtons};
})();
