/* public showcase mirror: real login is disabled here. */
window.giiiftLogin=function(){alert("This is the demo showcase \u2014 no login needed. Everything already runs in demo mode.");var b=document.getElementById("giiift-login-btn");if(b){b.disabled=false;b.textContent="Log in";}};
if(window.__giiiftWantLogin){window.__giiiftWantLogin=false;window.giiiftLogin();}
