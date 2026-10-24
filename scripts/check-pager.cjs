const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const source=fs.readFileSync(require('node:path').resolve(__dirname,'../src/ui/ExplorerPager.tsx'),'utf8');
const tree=ts.createSourceFile('pager.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let effect; const pointerExpressions=[];
function visit(node){
 if(ts.isCallExpression(node)&&node.expression.getText(tree)==='useEffect'&&node.arguments[0]?.getText(tree).includes('Animated.timing'))effect=node.arguments[0].getText(tree);
 if(ts.isJsxAttribute(node)&&node.name.getText(tree)==='pointerEvents')pointerExpressions.push(node.initializer.expression.getText(tree));
 ts.forEachChild(node,visit);
}visit(tree);
for(const screen of ['Map','Assistant']){
 const pointerEvents=pointerExpressions.map(expression=>Function('screen','transitioning',`return ${expression}`)(screen,true));
 assert.deepEqual(pointerEvents,screen==='Map'?['auto','none']:['none','auto'],'active page stays interactive during interrupted animations');
}
let transitioning=false; const transitionRef={current:false}; const completions=[];
const bindings={transitionRef,setTransitioning:value=>transitioning=value,Animated:{timing:()=>({start:callback=>completions.push(callback),stop:()=>{}})},offset:{setValue:()=>{}},screen:'Assistant',reduceMotion:false,Easing:{out:fn=>fn,cubic:()=>{}}};
const javascript=ts.transpileModule(`const effect=${effect}; return effect();`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const start=()=>Function(...Object.keys(bindings),javascript)(...Object.values(bindings));
const cleanup=start();
completions[0]({finished:false});
assert.equal(transitioning,false,'interrupted animation releases shake transition guard');
assert.equal(transitionRef.current,false);
cleanup(); start(); completions[0]({finished:true});
assert.equal(transitioning,true,'superseded completion cannot clear the new transition');
assert.equal(transitionRef.current,true);
completions[1]({finished:true});
assert.equal(transitioning,false);
console.log('Pager active-page touch ownership and interrupted transition checks passed');
