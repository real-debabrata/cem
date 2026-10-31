/* CEM 4.1.1: theme colour behind the status bar (notification bar), camera cut-out and navigation bar (Android app only).
   The native side is scripts/native/ThemeBarsPlugin.java (Capacitor.Plugins.ThemeBars). This file only tells it WHICH colour:
     - while the loading screen is showing: Midnight Navy (the loading screen's own colour), so there is no flash;
     - afterwards: the page background (--bg), re-sent whenever the theme changes (Profile menu > Theme, or the phone's dark mode).
   On the website (or when the plugin is missing) it does nothing. Loaded by index.html and login.html. */
(function(){
'use strict';

var SPLASH='#10172b';

function isApp(){var K=window.Capacitor;return !!(K&&K.isNativePlatform&&K.isNativePlatform())}
function plugin(){var K=window.Capacitor;return(isApp()&&K.Plugins&&K.Plugins.ThemeBars)||null}

/* "#abc", "#aabbcc", "rgb(1,2,3)", "rgba(1,2,3,.5)", "color(srgb r g b)" -> "#rrggbb" (or '' when it is not a plain opaque colour) */
function toHex(v){
  v=String(v==null?'':v).trim().toLowerCase();
  if(!v)return '';
  var m=v.match(/^#([0-9a-f]{3})$/);
  if(m)return '#'+m[1].split('').map(function(c){return c+c}).join('');
  m=v.match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/);
  if(m)return '#'+m[1];
  m=v.match(/^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)(?:[\s,/]+(\d*\.?\d+%?))?\s*\)$/);
  if(m){
    var a=m[4]==null?1:(/%$/.test(m[4])?parseFloat(m[4])/100:parseFloat(m[4]));
    if(a===0)return '';   // transparent: not a colour
    return '#'+[m[1],m[2],m[3]].map(function(n){n=Math.max(0,Math.min(255,Math.round(+n)));return(n<16?'0':'')+n.toString(16)}).join('');
  }
  m=v.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if(m)return '#'+[m[1],m[2],m[3]].map(function(n){n=Math.max(0,Math.min(255,Math.round(parseFloat(n)*255)));return(n<16?'0':'')+n.toString(16)}).join('');
  return '';
}

/* the colour the page really shows at its top edge */
function pageColor(){
  var cs=getComputedStyle(document.documentElement),c=toHex(cs.getPropertyValue('--bg'));
  if(c)return c;
  if(document.body){c=toHex(getComputedStyle(document.body).backgroundColor);if(c)return c}
  c=toHex(cs.backgroundColor);
  return c||SPLASH;
}

function splashShowing(){var s=document.getElementById('splash');return !!(s&&!s.classList.contains('out'))}

var last='',timer=0;
function send(color){
  var p=plugin();
  if(!p||!color||color===last)return;
  last=color;
  try{var r=p.set({color:color});if(r&&r.catch)r.catch(function(){last=''})}catch(e){last=''}
}
function apply(){send(splashShowing()?SPLASH:pageColor())}
function soon(ms){clearTimeout(timer);timer=setTimeout(apply,ms||0)}

if(typeof window!=='undefined'){window.CEMThemeBars={apply:apply,toHex:toHex}}
if(!isApp())return;

apply();

/* Profile menu > Theme sets (or removes) data-theme on <html> */
new MutationObserver(function(){soon(0)}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','class']});
/* the phone's own dark mode (theme = Auto) */
try{var mq=window.matchMedia('(prefers-color-scheme: dark)');if(mq.addEventListener)mq.addEventListener('change',function(){soon(50)});else if(mq.addListener)mq.addListener(function(){soon(50)})}catch(e){}
/* the loading screen fades out: switch to the page colour in the middle of the fade, not at the end */
(function(){var s=document.getElementById('splash');if(!s)return;
  new MutationObserver(function(){soon(250)}).observe(s,{attributes:true,attributeFilter:['class']})})();
/* back from another app (the phone's dark mode may have changed meanwhile) */
document.addEventListener('visibilitychange',function(){if(!document.hidden){last='';soon(0)}});
/* after the page has finished loading: stylesheets that define --bg may arrive after this script */
window.addEventListener('load',function(){soon(0);setTimeout(apply,400)});
})();
