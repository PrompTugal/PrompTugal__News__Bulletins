/* Scales the 1280x720 stage to the width of its box. */
(function(){function fit(){var b=document.getElementById('fit'),s=document.getElementById('stage');if(!b||!s)return;s.style.transform='scale('+(b.clientWidth/1280)+')';}window.addEventListener('resize',fit);fit();setInterval(fit,500);})();
