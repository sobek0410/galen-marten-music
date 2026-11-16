(function(){
'use strict';
function el(tag,text){var n=document.createElement(tag);if(text)n.textContent=text;return n;}
fetch('works.json').then(function(r){if(!r.ok)throw Error('samples');return r.json()}).then(function(samples){
var grid=document.getElementById('sample-grid');if(samples.length){grid.replaceChildren();var note=document.getElementById('selection-note');if(note)note.hidden=true;}
samples.forEach(function(s){
var yt=/^[a-zA-Z0-9_-]{11}$/.test(s.youtubeId||'');var vm=/^[0-9]+$/.test(s.vimeoId||'');var ext=/^https:\/\/vimeo\.com\/reviews\//.test(s.externalUrl||'');if((!yt&&!vm&&!ext)||!s.title)return;if(ext){var card=el('article');card.className='portfolio-work';card.appendChild(el('h3',s.title));if(s.description)card.appendChild(el('p',s.description));var a=el('a','Watch on Vimeo ↗');a.href=s.externalUrl;a.target='_blank';a.rel='noopener noreferrer';card.appendChild(a);grid.appendChild(card);return;}
var card=el('article');card.className='portfolio-work';
var frame=el('div');frame.className='portfolio-frame';
var img=el('img');if(yt)img.src='https://i.ytimg.com/vi/'+s.youtubeId+'/hqdefault.jpg';else img.hidden=true;img.alt=s.title;img.width=480;img.height=360;img.loading='lazy';frame.appendChild(img);
var b=el('button');b.type='button';b.setAttribute('aria-label','Play '+s.title);var play=el('span','▶');play.setAttribute('aria-hidden','true');b.appendChild(play);
b.addEventListener('click',function(){var f=el('iframe');f.src=yt?'https://www.youtube-nocookie.com/embed/'+s.youtubeId+'?autoplay=1&rel=0':'https://player.vimeo.com/video/'+s.vimeoId+'?autoplay=1';f.title=s.title;f.allow='autoplay; encrypted-media; picture-in-picture';f.allowFullscreen=true;frame.replaceChildren(f)});frame.appendChild(b);card.appendChild(frame);card.appendChild(el('h3',s.title));if(s.role){var role=el('p',s.role);role.className='portfolio-meta';card.appendChild(role)}if(s.description)card.appendChild(el('p',s.description));var a=el('a',yt?'Watch on YouTube ↗':'Watch on Vimeo ↗');a.href=yt?'https://www.youtube.com/watch?v='+s.youtubeId:'https://vimeo.com/'+s.vimeoId;a.target='_blank';a.rel='noopener noreferrer';card.appendChild(a);grid.appendChild(card);
});if(grid.children.length)document.getElementById('work-samples').hidden=false;
}).catch(function(){/* Featured trailer and résumé remain available. */});
})();
