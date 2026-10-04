// PDF.js uses these APIs in both the page and its worker. Older Android WebViews
// already support module workers, but need the standard Promise helpers.
if(!Promise.withResolvers)Object.defineProperty(Promise,'withResolvers',{configurable:true,writable:true,value:function(){let resolve,reject;const promise=new this((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}});
if(!Promise.try)Object.defineProperty(Promise,'try',{configurable:true,writable:true,value:function(callback,...args){return new this(resolve=>resolve(callback(...args)));}});
// ReadableStream async iteration arrived after the WebView shipped with Android 13.
if(typeof ReadableStream!=='undefined'&&!ReadableStream.prototype[Symbol.asyncIterator])Object.defineProperty(ReadableStream.prototype,Symbol.asyncIterator,{configurable:true,writable:true,value:async function*(){const reader=this.getReader();let complete=false;try{while(true){const next=await reader.read();if(next.done){complete=true;return;}yield next.value;}}finally{try{if(!complete)await reader.cancel();}finally{reader.releaseLock();}}}});
