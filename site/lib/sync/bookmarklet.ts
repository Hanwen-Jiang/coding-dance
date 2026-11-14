// 「同步力扣」书签：用户把它拖到书签栏，在 leetcode.cn 的页面上点一下。
// 它只做三件事：打开本站的同步页；回应同步页的招呼；替同步页在力扣页面里发只读的 GraphQL 查询。
// 只认本站同步页发来的消息（来源和窗口都要对上），查询里带 mutation 的一律拒绝。
// 写成字符串而不是函数，免得打包工具改写它。

const SOURCE = `(function(S){
if(location.hostname!=="leetcode.cn"){alert("请在 leetcode.cn 的页面上点这个书签（先登录力扣）");return}
var w=window.open(S+"/sync/?from=leetcode","hot100-sync");
if(!w){alert("浏览器拦截了弹出的窗口：请允许 leetcode.cn 打开新窗口，再点一次书签");return}
window.__hot100w=w;
if(window.__hot100on)return;
window.__hot100on=1;
addEventListener("message",function(e){
if(e.origin!==S||e.source!==window.__hot100w)return;
var m=e.data||{},reply=function(x){e.source.postMessage(x,S)};
if(m.type==="hot100:hello")return reply({type:"hot100:ready"});
if(m.type!=="hot100:query")return;
var q=m.query;
if(typeof q!=="string"||!/^\\s*query[\\s({]/.test(q)||/\\bmutation\\b/i.test(q))return reply({type:"hot100:result",id:m.id,res:{status:0,text:"书签只转发只读查询"}});
var c=(document.cookie.match(/(?:^|;\\s*)csrftoken=([^;]+)/)||[])[1]||"";
fetch("/graphql/",{method:"POST",credentials:"include",headers:{"content-type":"application/json","x-csrftoken":c},body:JSON.stringify({query:q,variables:m.variables})})
.then(function(r){return r.text().then(function(t){var res;try{res={status:r.status,json:JSON.parse(t)}}catch(x){res={status:r.status,text:t.slice(0,300)}}reply({type:"hot100:result",id:m.id,res:res})})})
.catch(function(x){reply({type:"hot100:result",id:m.id,res:{status:0,text:String(x)}})});
});
})`;

/** 书签的地址；site 是本站的来源（线上是 https://leetcode.cgent.link，本地预览时是 localhost） */
export const bookmarklet = (site: string) => "javascript:" + encodeURIComponent(`${SOURCE.replace(/\n/g, "")}(${JSON.stringify(site)});void 0`);

/** 测试用：拿到书签里那段函数的源码 */
export const bookmarkletSource = SOURCE;
