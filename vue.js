let activeEffect
const effectStack = []
/**
 * 解决分支切换的bug.在如下情况obj.text?obj.ok:"1",修改obj.ok也会触发响应的依赖函数
 * @param effectFn
 */
const cleanup = (effectFn) => {
    for (let i = 0; i < effectFn.deps.length; i++) {
        const deps = effectFn.deps[i]
        deps.delete(effectFn)
    }
    effectFn.deps.length = 0
}
/**
 * 依赖函数
 * @param fn
 * @param option
 * @returns {function(): *}
 */
const effect =(fn, option = {})=>{
    const effectFn = ()=>{
        cleanup(effectFn)
        activeEffect = effectFn
        effectStack.push(effectFn)
        const res = fn()
        effectStack.pop()
        activeEffect = effectStack[effectStack.length -1]
        return res;
    }
    effectFn.deps = []
    effectFn.option = option
    if (!option.lazy) {
        effectFn()
    }
    return effectFn;
}




// -------------------------------------------------------------------------------------------------




/**
 * 将变量变为响应式
 * @param data
 * @returns {*}
 */
const ref = (data)=>{
    return new Proxy(data, {
            get(target, key) {
                track(target, key)
                return target[key]
            },
            set(target, key, newVal) {
                target[key] = newVal
                trigger(target,key)
            }
        }
    )
}
/**
 * 响应式数据收集依赖函数
 * @type {WeakMap<object, any>}
 */
const bucket = new WeakMap()
const track = (target,key)=>{
    if (!activeEffect) return
    let depsMap = bucket.get(target)
    if (!depsMap) {
        bucket.set(target,(depsMap = new Map()))
    }
    let deps = depsMap.get(key)
    if (!deps) {
        depsMap.set(key,(deps = new Set()))
    }
    deps.add(activeEffect)
    activeEffect.deps.push(deps)
}
/**
 * 响应式数据被修改后,触发依赖函数
 * @param target
 * @param key
 */
const trigger = (target,key) => {
    const depsMap = bucket.get(target)
    if (!depsMap) return
    const effects = depsMap.get(key)
    // 第一种避免无限循环递归调用 原因 forEach会因为Set先delete后add造成无限循环(cleanup会delete track会重新add)
    // 解决办法:通过新建一个Set变量即可
    const effectsToRun = new Set()
    // 第二种避免无限循环递归调用  原因 ++自增这种 obj.a++  实际上是obj.a = obj.a + 1 存在先get后set,造成无限递归调用
    // 解决办法:通过判断当前运行函数与当前函数要运行函数是否相同,相同则不触发
    effects&&effects.forEach(effectFn => {
        if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
        }
    })
    effectsToRun.forEach(effectFn => {
        if (effectFn.option.scheduler) {
            effectFn.option.scheduler(effectFn)
        } else {
            effectFn()
        }
    })
}



