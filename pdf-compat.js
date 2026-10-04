// PDF.js uses these APIs in both the page and its worker. Older Android WebViews
// already support module workers, but need the standard Promise helpers.
if(!Promise.withResolvers)Object.defineProperty(Promise,'withResolvers',{configurable:true,writable:true,value:function(){let resolve,reject;const promise=new this((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}});
if(!Promise.try)Object.defineProperty(Promise,'try',{configurable:true,writable:true,value:function(callback,...args){return new this(resolve=>resolve(callback(...args)));}});
