const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('cloud.js','utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness({configured=true,stored=true,handler}={}){
 const elements=new Map(),calls=[],messages=[];let renders=0;
 function element(key){if(!elements.has(key))elements.set(key,{textContent:'',innerHTML:'',hidden:false,listeners:{},elements:{password:{value:'test-password'}},addEventListener(type,fn){this.listeners[type]=fn;},showModal(){this.open=true;},close(){this.open=false;},append(){},prepend(){},querySelector(){return element(key+' button');}});return elements.get(key);}
 const current={access_token:'user-jwt',refresh_token:'refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'user-1',email:'test@example.com'}};
 const store=new Map(stored?[['kindred-session',JSON.stringify(current)]]:[]);
 const context=vm.createContext({console,Date,JSON,Promise,Node:{TEXT_NODE:3},document:{head:{append(){}},body:{append(){}},createElement:()=>element(Symbol()),querySelectorAll:()=>[],addEventListener(){}},$:element,window:{KINDRED_CONFIG:configured?{url:'https://test.supabase.co',key:'sb_publishable_test'}:{},addEventListener(){}},sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},state:{demo:true},page:'today',render(){renders++;},escapeHTML:s=>String(s),dose:()=>null,toast:m=>messages.push(m),fetch:async(url,options)=>{calls.push({url,...options,body:options.body?JSON.parse(options.body):undefined});const result=await handler?.(url,options);return {ok:result?.ok!==false,json:async()=>result?.data??null};},FormData:class {constructor(form){return Object.entries(form.data);}}});
 vm.runInContext(source,context);
 return {context,elements,calls,messages,element,store,get renders(){return renders;}};
}
const snapshot={profile:{id:'profile-1',name:'Test Person',age:76,revision:2,extras:{}},meds:[{id:'med-1',name:'Test pill',time:'08:30:00'}],doses:[{medication_id:'med-1',dose_date:'2026-11-15',status:'taken',recorded_at:'2026-11-15T08:30:00Z'}],appointments:[],members:[{user_id:'user-1',display_name:'Test Owner',role:'owner'}]};
function defaultHandler(url){if(url.includes('/profiles?'))return {data:[{id:'profile-1',name:'Test Person'}]};if(url.includes('/load_care_profile'))return {data:snapshot};return {data:3};}
test('configured mode replaces demo state and loads relational data without local caching',async()=>{
 const h=harness({handler:defaultHandler});await tick();await tick();
 assert.equal(h.context.state.meds[0].time,'08:30');assert.equal(h.context.state.demo,undefined);
 assert.equal(h.context.state.doses['2026-11-15-med-1'].status,'taken');
 assert.equal(h.calls[0].headers.Authorization,'Bearer user-jwt');
 assert.equal(h.element('#sync-status').textContent,'Saved to Supabase');
});
test('saves are serialized and use the previous server revision',async()=>{
 let release;const blocker=new Promise(r=>release=r);let writes=0;
 const h=harness({handler:async url=>{if(url.includes('/save_care_profile')){writes++;if(writes===1)await blocker;return {data:2+writes};}return defaultHandler(url);}});await tick();await tick();
 h.context.window.careCloud.save({meds:[{name:'First'}]});h.context.window.careCloud.save({meds:[{name:'Second'}]});assert.equal(writes,1);release();await tick();await tick();
 const saves=h.calls.filter(c=>c.url.includes('/save_care_profile'));assert.equal(saves.length,2);assert.equal(saves[0].body.expected_revision,2);assert.equal(saves[1].body.expected_revision,3);assert.equal(saves[1].body.payload.meds[0].name,'Second');
});
test('conflict errors are visible and block further saves',async()=>{
 const h=harness({handler:url=>url.includes('/save_care_profile')?{ok:false,data:{message:'Profile changed on another device'}}:defaultHandler(url)});await tick();await tick();
 h.context.window.careCloud.save({meds:[]});await tick();h.context.window.careCloud.save({meds:[]});
 assert.equal(h.calls.filter(c=>c.url.includes('/save_care_profile')).length,1);assert.match(h.element('#sync-status').textContent,/failed/);assert.match(h.messages[0],/not saved/);
});
test('no configuration keeps the local demo and makes no network calls',()=>{
 const h=harness({configured:false});assert.equal(h.context.state.demo,true);assert.equal(h.calls.length,0);assert.equal(h.element('#cloud-account').textContent,'Connect Supabase');
});
test('signup without a session requires email confirmation',async()=>{
 const h=harness({stored:false,handler:()=>({data:{user:{id:'new-user'}}})});h.element('#auth-switch').listeners.click();
 await h.element('#auth-form').listeners.submit({preventDefault(){},target:{data:{email:'test@example.com',password:'test-password'},elements:{password:{value:'test-password'}}}});
 assert.match(h.calls[0].url,/auth\/v1\/signup/);assert.match(h.element('#auth-error').textContent,/confirm/);assert.equal(h.store.has('kindred-session'),false);
});
test('expired sessions refresh before reading profile data',async()=>{
 const h=harness({stored:false,handler:url=>url.includes('grant_type=password')?{data:{access_token:'expired',refresh_token:'refresh',expires_at:1,user:{id:'user-1'}}}:url.includes('grant_type=refresh_token')?{data:{access_token:'renewed',refresh_token:'new-refresh',expires_in:3600,user:{id:'user-1'}}}:defaultHandler(url)});
 await h.element('#auth-form').listeners.submit({preventDefault(){},target:{data:{email:'test@example.com',password:'test-password'},elements:{password:{value:'test-password'}}}});
 const read=h.calls.find(c=>c.url.includes('/profiles?'));assert.equal(read.headers.Authorization,'Bearer renewed');
});
